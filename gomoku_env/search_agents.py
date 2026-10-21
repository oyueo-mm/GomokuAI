"""Shared reference opponents for the playable game and the research arena.

These are transparent, non-neural baselines, not trained AlphaZero models.
"""
from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter

import numpy as np

from .agents import _threat_score, _would_win, choose_move as choose_tactical
from .game import GomokuGame

WIN = 10_000_000.0


@dataclass(frozen=True)
class Decision:
    action: int
    algorithm: str
    nodes: int
    seconds: float
    score: float | None = None


def candidate_actions(game: GomokuGame, radius: int = 1) -> list[int]:
    """All unoccupied cells adjacent to stones, except the empty-board center."""
    if game.done:
        return []
    size = game.board_size
    stones = np.argwhere(game.board != 0)
    if len(stones) == 0:
        return [(size // 2) * size + size // 2]
    candidates: set[int] = set()
    for row, col in stones:
        row, col = int(row), int(col)
        for dr in range(-radius, radius + 1):
            for dc in range(-radius, radius + 1):
                r, c = row + dr, col + dc
                if 0 <= r < size and 0 <= c < size and game.board[r, c] == 0:
                    candidates.add(r * size + c)
    return sorted(candidates)


def rank_actions(game: GomokuGame, width: int | None = 10) -> list[tuple[int, float]]:
    """Heuristic action ordering, with all one-move wins and blocks preserved."""
    options = candidate_actions(game, radius=2)
    if not options:
        return []
    player, size = game.current_player, game.board_size
    center = (size - 1) / 2
    evaluated: list[tuple[int, float]] = []
    wins, blocks = [], []
    for action in options:
        row, col = divmod(action, size)
        win_now = _would_win(game.board, row, col, player, game.win_length)
        block_now = _would_win(game.board, row, col, -player, game.win_length)
        if win_now:
            wins.append(action)
        if block_now:
            blocks.append(action)
        attack = _threat_score(game.board, row, col, player, game.win_length)
        defense = _threat_score(game.board, row, col, -player, game.win_length)
        positional = -0.002 * ((row - center) ** 2 + (col - center) ** 2)
        evaluated.append((action, attack + 1.1 * defense + positional))
    evaluated.sort(key=lambda item: (-item[1], item[0]))
    if wins:
        return [item for item in evaluated if item[0] in wins]
    if blocks:
        return [item for item in evaluated if item[0] in blocks]
    return evaluated[:width] if width is not None else evaluated


def evaluate_position(game: GomokuGame) -> float:
    """Bounded one-ply tactical evaluation from the side-to-move perspective."""
    if game.done:
        return 0.0
    options = candidate_actions(game, radius=2)
    if not options:
        return 0.0
    self_scores, opponent_scores = [], []
    for action in options:
        row, col = divmod(action, game.board_size)
        self_scores.append(_threat_score(game.board, row, col, game.current_player, game.win_length))
        opponent_scores.append(_threat_score(game.board, row, col, -game.current_player, game.win_length))
    self_scores.sort(reverse=True)
    opponent_scores.sort(reverse=True)
    return (self_scores[0] + 0.4 * self_scores[1] if len(self_scores) > 1 else self_scores[0]) - (1.1 * opponent_scores[0] + 0.35 * opponent_scores[1] if len(opponent_scores) > 1 else 1.1 * opponent_scores[0])


def choose_alphabeta(game: GomokuGame, depth: int = 2, width: int = 8) -> Decision:
    """Depth-limited negamax, alpha-beta pruning, forcing wins/blocks retained."""
    if game.done:
        raise ValueError("Game is already over")
    if depth not in (1, 2, 3):
        raise ValueError("depth must be 1, 2, or 3")
    if not 2 <= width <= 20:
        raise ValueError("width must be in [2, 20]")
    started = perf_counter()
    nodes = 0

    def search(state: GomokuGame, remaining: int, alpha: float, beta: float) -> float:
        nonlocal nodes
        nodes += 1
        if remaining == 0 or state.done:
            return evaluate_position(state)
        best = -float("inf")
        for action, _ in rank_actions(state, width=width):
            next_state = state.clone()
            result = next_state.step(action)
            if result.done:
                value = WIN + remaining if result.winner is not None else 0.0
            else:
                value = -search(next_state, remaining - 1, -beta, -alpha)
            best = max(best, value)
            alpha = max(alpha, value)
            if alpha >= beta:
                break
        return best if best != -float("inf") else 0.0

    options = rank_actions(game, width=width)
    if not options:
        raise ValueError("No legal moves")
    best_action, best_score = options[0][0], -float("inf")
    alpha = -float("inf")
    for action, _ in options:
        after = game.clone()
        result = after.step(action)
        if result.done:
            value = WIN + depth if result.winner is not None else 0.0
        else:
            value = -search(after, depth - 1, -float("inf"), -alpha)
        if value > best_score:
            best_score, best_action = value, action
        alpha = max(alpha, value)
    return Decision(best_action, "alphabeta", nodes, perf_counter() - started, best_score)


def choose_action(game: GomokuGame, algorithm: str = "tactical", rng: np.random.Generator | None = None, depth: int = 2) -> Decision:
    if game.done:
        raise ValueError("Game is already over")
    started = perf_counter()
    if algorithm == "random":
        rng = rng if rng is not None else np.random.default_rng()
        action = int(rng.choice(np.flatnonzero(game.valid_moves_mask())))
        return Decision(action, algorithm, 1, perf_counter() - started)
    if algorithm == "tactical":
        action = choose_tactical(game)
        return Decision(action, algorithm, 1, perf_counter() - started)
    if algorithm == "alphabeta":
        return choose_alphabeta(game, depth=depth, width=7 if depth >= 3 else 9)
    raise ValueError(f"Unknown algorithm: {algorithm}")
