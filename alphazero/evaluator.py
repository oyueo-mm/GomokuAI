from __future__ import annotations

from typing import List, Protocol, Tuple

import numpy as np


class Evaluator(Protocol):
    """Anything MCTS needs: batched (priors, value) predictions for board planes."""

    def evaluate_batch(self, states: List[np.ndarray]) -> Tuple[np.ndarray, np.ndarray]:
        ...


class NetEvaluator:
    """Wraps a GomokuNet for MCTS: numpy planes in, numpy (priors, value) out."""

    def __init__(self, model, device: str = "cpu"):
        import torch

        self._torch = torch
        self.model = model.to(device)
        self.device = device

    def evaluate_batch(self, states: List[np.ndarray]):
        torch = self._torch
        batch = torch.from_numpy(np.stack(states)).float().to(self.device)
        policy_probs, value = self.model.predict(batch)
        return policy_probs.cpu().numpy(), value.cpu().numpy()


class DummyEvaluator:
    """Uniform-policy, zero-value evaluator. Used to unit-test MCTS without torch."""

    def __init__(self, action_size: int, rng: np.random.Generator | None = None):
        self.action_size = action_size
        self.rng = rng or np.random.default_rng(0)

    def evaluate_batch(self, states: List[np.ndarray]):
        n = len(states)
        priors = np.full((n, self.action_size), 1.0 / self.action_size, dtype=np.float32)
        values = self.rng.uniform(-1.0, 1.0, size=n).astype(np.float32)
        return priors, values
