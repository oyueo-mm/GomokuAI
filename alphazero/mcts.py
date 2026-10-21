from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

import numpy as np

from gomoku_env.encoding import encode
from gomoku_env.game import GomokuGame

from .config import AlphaZeroConfig


class Node:
    """A tree node's own (visit_count, value_sum) live in its PARENT's arrays
    (indexed by `index_in_parent`), not as scalar attributes on the node
    itself. This lets `select_child` score every child with vectorized numpy
    ops instead of a Python loop, and lets `expand` skip creating a child
    Node object for actions that never actually get selected (in practice
    most legal moves are never visited within a move's simulation budget —
    see the mcts.py module docstring-adjacent design notes). Root has no
    parent, so it keeps its own scalar counters directly.
    """

    __slots__ = (
        "parent", "index_in_parent", "prior", "expanded",
        "_actions", "_priors", "_visits", "_values", "_child_nodes",
        "_root_visit_count", "_root_value_sum",
    )

    def __init__(self, parent: Optional["Node"], index_in_parent: Optional[int], prior: float):
        self.parent = parent
        self.index_in_parent = index_in_parent
        self.prior = prior
        self.expanded = False
        self._actions: Optional[np.ndarray] = None
        self._priors: Optional[np.ndarray] = None
        self._visits: Optional[np.ndarray] = None
        self._values: Optional[np.ndarray] = None
        self._child_nodes: Optional[List[Optional["Node"]]] = None
        if parent is None:
            self._root_visit_count = 0
            self._root_value_sum = 0.0

    @property
    def visit_count(self):
        if self.parent is None:
            return self._root_visit_count
        return self.parent._visits[self.index_in_parent]

    @visit_count.setter
    def visit_count(self, value):
        if self.parent is None:
            self._root_visit_count = value
        else:
            self.parent._visits[self.index_in_parent] = value

    @property
    def value_sum(self):
        if self.parent is None:
            return self._root_value_sum
        return self.parent._values[self.index_in_parent]

    @value_sum.setter
    def value_sum(self, value):
        if self.parent is None:
            self._root_value_sum = value
        else:
            self.parent._values[self.index_in_parent] = value

    @property
    def children(self) -> Dict[int, "Node"]:
        """Dict-like {action: child} view for introspection/tests. Materializes
        every child Node lazily; not used on the hot path (select_child)."""
        if self._actions is None:
            return {}
        result = {}
        for i, action in enumerate(self._actions):
            result[int(action)] = self._get_or_create_child(i)
        return result

    def q_value(self) -> float:
        vc = self.visit_count
        return self.value_sum / vc if vc > 0 else 0.0

    def _get_or_create_child(self, idx: int) -> "Node":
        child = self._child_nodes[idx]
        if child is None:
            child = Node(self, idx, float(self._priors[idx]))
            self._child_nodes[idx] = child
        return child

    def select_child(self, c_puct: float) -> Tuple[int, "Node"]:
        sqrt_parent_n = math.sqrt(max(self.visit_count, 1))
        visits = self._visits
        safe_visits = np.where(visits > 0, visits, 1.0)
        q = np.where(visits > 0, -self._values / safe_visits, 0.0)
        u = c_puct * self._priors * sqrt_parent_n / (1.0 + visits)
        idx = int(np.argmax(q + u))
        return int(self._actions[idx]), self._get_or_create_child(idx)

    def expand(self, legal_mask: np.ndarray, priors: np.ndarray):
        masked = priors * legal_mask
        total = masked.sum()
        if total > 1e-8:
            masked = masked / total
        else:
            masked = legal_mask / legal_mask.sum()
        actions = np.flatnonzero(legal_mask)
        n = len(actions)
        self._actions = actions
        self._priors = masked[actions].astype(np.float64)
        self._visits = np.zeros(n, dtype=np.float64)
        self._values = np.zeros(n, dtype=np.float64)
        self._child_nodes = [None] * n
        self.expanded = True

    def add_dirichlet_noise(self, alpha: float, epsilon: float, rng: np.random.Generator):
        noise = rng.dirichlet([alpha] * len(self._actions))
        self._priors = (1 - epsilon) * self._priors + epsilon * noise


class MCTSTree:
    """A single game's MCTS search tree, rebuilt fresh at the start of each move.

    Designed for virtual-loss batching: call `select_leaf()` repeatedly to
    collect several in-flight leaves before doing a single batched NN call,
    then `backup()` each result. See SelfPlayBatch for the driving loop.
    """

    def __init__(self, config: AlphaZeroConfig, rng: np.random.Generator, add_root_noise: bool = True):
        self.config = config
        self.rng = rng
        self.add_root_noise = add_root_noise
        self.root: Optional[Node] = None
        self.root_game: Optional[GomokuGame] = None

    def set_root(self, game: GomokuGame):
        self.root = Node(parent=None, index_in_parent=None, prior=1.0)
        self.root_game = game.clone()

    def select_leaf(self) -> Tuple[Node, GomokuGame, List[Node], bool]:
        """Descend from root applying virtual loss; returns (leaf, leaf_game, path, is_root)."""
        node = self.root
        game = self.root_game.clone()
        path = [node]
        while node.expanded and not game.done:
            action, child = node.select_child(self.config.c_puct)
            game.step(action)
            child.visit_count += self.config.virtual_loss
            child.value_sum += self.config.virtual_loss
            path.append(child)
            node = child
        return node, game, path, (len(path) == 1)

    def expand_and_backup(self, path: List[Node], leaf_game: GomokuGame, priors: np.ndarray, value: float):
        leaf = path[-1]
        is_root = len(path) == 1
        # Several in-flight simulations may select the same unexpanded leaf.
        # Expanding twice would erase the first simulation's child statistics.
        if not leaf_game.done and not leaf.expanded:
            leaf.expand(leaf_game.valid_moves_mask(), priors)
            if is_root and self.add_root_noise:
                leaf.add_dirichlet_noise(
                    self.config.dirichlet_alpha, self.config.dirichlet_epsilon, self.rng
                )
        self.backup(path, value)

    def backup(self, path: List[Node], leaf_value: float):
        v = leaf_value
        vl = self.config.virtual_loss
        for i in range(len(path) - 1, -1, -1):
            node = path[i]
            if i == 0:
                node.visit_count += 1
                node.value_sum += v
            else:
                node.visit_count += 1 - vl
                node.value_sum += v - vl
            v = -v

    def root_policy(self, temperature: float) -> Tuple[int, np.ndarray]:
        action_size = self.config.action_size
        policy = np.zeros(action_size, dtype=np.float32)
        actions = self.root._actions
        visits = self.root._visits
        total = visits.sum()
        if total > 0:
            policy[actions] = (visits / total).astype(np.float32)

        if temperature <= 1e-3:
            chosen = int(actions[int(np.argmax(visits))])
        else:
            weighted = (visits / max(float(visits.max()), 1.0)) ** (1.0 / temperature)
            if weighted.sum() == 0:
                weighted = self.root._priors.copy()
            weighted = weighted / weighted.sum()
            chosen = int(self.rng.choice(actions, p=weighted))
        return chosen, policy


def terminal_value(game: GomokuGame) -> float:
    """Value from the perspective of the player who would move next (already game over)."""
    return 0.0 if game.winner is None else -1.0


def expand_roots(trees: List[MCTSTree], evaluator):
    """Expand each tree's (fresh, unexpanded) root in one batched NN call.

    Must run before the main simulation loop: without it, every simulation
    in the first batched round would redundantly re-select the same
    not-yet-expanded root instead of visiting a real child, silently
    dropping that many simulations from the visit-count budget.
    """
    pending = [(tree, tree.select_leaf()) for tree in trees if not tree.root.expanded]
    if not pending:
        return
    need_eval = []
    for tree, (node, game, path, _) in pending:
        if game.done:
            tree.backup(path, terminal_value(game))
        else:
            need_eval.append((tree, node, game, path))
    if need_eval:
        states = [encode(g) for (_, _, g, _) in need_eval]
        priors_batch, values_batch = evaluator.evaluate_batch(states)
        for (tree, node, g, path), priors, value in zip(need_eval, priors_batch, values_batch):
            tree.expand_and_backup(path, g, priors, float(value))


def run_search(tree: MCTSTree, evaluator, config: AlphaZeroConfig):
    """Run config.num_simulations simulations on a single tree (no cross-game batching)."""
    expand_roots([tree], evaluator)
    remaining = config.num_simulations
    while remaining > 0:
        batch_size = min(config.sim_batch, remaining)
        leaves = [tree.select_leaf() for _ in range(batch_size)]
        need_eval = [(node, g, path) for (node, g, path, _) in leaves if not g.done]
        if need_eval:
            states = [encode(g) for (_, g, _) in need_eval]
            priors_batch, values_batch = evaluator.evaluate_batch(states)
            for (node, g, path), priors, value in zip(need_eval, priors_batch, values_batch):
                tree.expand_and_backup(path, g, priors, float(value))
        for node, g, path, _ in leaves:
            if g.done:
                tree.backup(path, terminal_value(g))
        remaining -= batch_size
