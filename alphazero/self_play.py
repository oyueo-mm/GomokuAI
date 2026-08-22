from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import numpy as np

from gomoku_env.encoding import encode
from gomoku_env.game import GomokuGame

from .config import AlphaZeroConfig
from .mcts import MCTSTree, expand_roots, terminal_value


@dataclass
class Example:
    state: np.ndarray  # (3, H, W)
    policy: np.ndarray  # (H*W,)
    value: float  # z, from `state`'s player-to-move perspective


class SelfPlayBatch:
    """Plays `num_games` games concurrently, merging their MCTS leaves into
    shared NN batches each round for GPU efficiency (see mcts.MCTSTree)."""

    def __init__(self, evaluator, config: AlphaZeroConfig, num_games: int, rng: np.random.Generator):
        self.evaluator = evaluator
        self.config = config
        self.rng = rng
        self.games = [GomokuGame(config.board_size, config.win_length) for _ in range(num_games)]
        self.trees = [MCTSTree(config, rng) for _ in range(num_games)]
        self.histories: List[List[Tuple[np.ndarray, np.ndarray, int]]] = [[] for _ in range(num_games)]
        self.move_counts = [0] * num_games
        self.finished = [False] * num_games
        self.examples: List[Example] = []

    def _active_indices(self):
        return [i for i in range(len(self.games)) if not self.finished[i]]

    def _search_move(self, active: List[int]):
        for i in active:
            self.trees[i].set_root(self.games[i])
        expand_roots([self.trees[i] for i in active], self.evaluator)
        remaining = {i: self.config.num_simulations for i in active}

        while any(remaining[i] > 0 for i in active):
            leaves = []
            for i in active:
                if remaining[i] <= 0:
                    continue
                count = min(self.config.sim_batch, remaining[i])
                for _ in range(count):
                    node, game, path, _ = self.trees[i].select_leaf()
                    leaves.append((i, node, game, path))
            if not leaves:
                break

            need_eval = [(i, node, g, path) for (i, node, g, path) in leaves if not g.done]
            terminal = [(i, node, g, path) for (i, node, g, path) in leaves if g.done]

            if need_eval:
                states = [encode(g) for (_, _, g, _) in need_eval]
                priors_batch, values_batch = self.evaluator.evaluate_batch(states)
                for (i, node, g, path), priors, value in zip(need_eval, priors_batch, values_batch):
                    self.trees[i].expand_and_backup(path, g, priors, float(value))
                    remaining[i] -= 1

            for i, node, g, path in terminal:
                self.trees[i].backup(path, terminal_value(g))
                remaining[i] -= 1

    def _play_move(self, i: int):
        temperature = 1.0 if self.move_counts[i] < self.config.temperature_moves else 0.0
        action, visit_policy = self.trees[i].root_policy(temperature)
        state = encode(self.games[i])
        player = self.games[i].current_player
        self.histories[i].append((state, visit_policy, player))

        result = self.games[i].step(action)
        self.move_counts[i] += 1
        if result.done:
            self.finished[i] = True
            for state, policy, mover in self.histories[i]:
                z = 0.0 if result.winner is None else (1.0 if result.winner == mover else -1.0)
                self.examples.append(Example(state=state, policy=policy, value=z))

    def play(self) -> List[Example]:
        while not all(self.finished):
            active = self._active_indices()
            self._search_move(active)
            for i in active:
                self._play_move(i)
        return self.examples


def generate_self_play_examples(
    evaluator,
    config: AlphaZeroConfig,
    rng: np.random.Generator,
) -> List[Example]:
    """Plays config.games_per_iteration games in waves of config.parallel_games,
    keeping the concurrent batch (and thus the NN batch size) roughly constant."""
    examples: List[Example] = []
    remaining = config.games_per_iteration
    while remaining > 0:
        n = min(config.parallel_games, remaining)
        batch = SelfPlayBatch(evaluator, config, n, rng)
        examples.extend(batch.play())
        remaining -= n
    return examples
