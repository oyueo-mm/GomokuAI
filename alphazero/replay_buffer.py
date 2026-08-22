from __future__ import annotations

from collections import deque
from pathlib import Path
from typing import List

import numpy as np

from .self_play import Example
from .symmetry import random_symmetry


class ReplayBuffer:
    """Fixed-capacity FIFO buffer of (state, policy, value) training examples.

    Saves/loads to a single .npz file so it survives Colab session restarts.
    """

    def __init__(self, capacity: int, rng: np.random.Generator):
        self.capacity = capacity
        self.rng = rng
        self.states: deque = deque(maxlen=capacity)
        self.policies: deque = deque(maxlen=capacity)
        self.values: deque = deque(maxlen=capacity)

    def __len__(self) -> int:
        return len(self.states)

    def add_examples(self, examples: List[Example], augment: bool = True):
        for ex in examples:
            state, policy = ex.state, ex.policy
            if augment:
                state, policy = random_symmetry(state, policy, self.rng)
            self.states.append(state.astype(np.int8))
            self.policies.append(policy.astype(np.float32))
            self.values.append(np.float32(ex.value))

    def sample(self, batch_size: int):
        n = len(self.states)
        idx = self.rng.integers(0, n, size=min(batch_size, n))
        states = np.stack([self.states[i] for i in idx]).astype(np.float32)
        policies = np.stack([self.policies[i] for i in idx])
        values = np.array([self.values[i] for i in idx], dtype=np.float32)
        return states, policies, values

    def save(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            path,
            states=np.stack(self.states) if self.states else np.empty((0,)),
            policies=np.stack(self.policies) if self.policies else np.empty((0,)),
            values=np.array(self.values, dtype=np.float32),
        )

    def load(self, path: str):
        data = np.load(path)
        self.states = deque(data["states"], maxlen=self.capacity)
        self.policies = deque(data["policies"], maxlen=self.capacity)
        self.values = deque(data["values"], maxlen=self.capacity)
