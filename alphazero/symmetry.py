from __future__ import annotations

import numpy as np

# The square board has 8 symmetries (dihedral group D4): 4 rotations, each
# optionally mirrored. Every symmetry maps legal games to legal games, so
# applying a random one to each training example is free data augmentation.


def all_symmetries(state: np.ndarray, policy: np.ndarray):
    """Yield all 8 (state, policy) pairs related by board symmetry.

    state: array shaped (C, H, W). policy: flat array shaped (H*W,).
    """
    board_size = state.shape[-1]
    policy_grid = policy.reshape(board_size, board_size)
    for k in range(4):
        rotated_state = np.rot90(state, k, axes=(1, 2))
        rotated_policy = np.rot90(policy_grid, k)
        yield rotated_state.copy(), rotated_policy.reshape(-1).copy()
        mirrored_state = np.flip(rotated_state, axis=2)
        mirrored_policy = np.flip(rotated_policy, axis=1)
        yield mirrored_state.copy(), mirrored_policy.reshape(-1).copy()


def random_symmetry(state: np.ndarray, policy: np.ndarray, rng: np.random.Generator):
    """Apply one randomly chosen symmetry (uniform over the 8) to (state, policy)."""
    board_size = state.shape[-1]
    policy_grid = policy.reshape(board_size, board_size)
    k = int(rng.integers(0, 4))
    flip = bool(rng.integers(0, 2))
    state = np.rot90(state, k, axes=(1, 2))
    policy_grid = np.rot90(policy_grid, k)
    if flip:
        state = np.flip(state, axis=2)
        policy_grid = np.flip(policy_grid, axis=1)
    return state.copy(), policy_grid.reshape(-1).copy()
