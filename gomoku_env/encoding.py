from __future__ import annotations

import numpy as np

from .game import BLACK, GomokuGame

NUM_PLANES = 3


def encode(game: GomokuGame) -> np.ndarray:
    """Encode a game state from the perspective of the player about to move.

    Channel 0: current player's stones. Channel 1: opponent's stones.
    Channel 2: all-ones if the current player is Black (moved first), else
    all-zeros. Shared by GomokuEnv and the AlphaZero MCTS/self-play code so
    both see identical inputs.
    """
    player = game.current_player
    own = (game.board == player).astype(np.int8)
    opp = (game.board == -player).astype(np.int8)
    color_plane = np.full_like(own, fill_value=1 if player == BLACK else 0)
    return np.stack([own, opp, color_plane])
