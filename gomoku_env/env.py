from __future__ import annotations

from typing import Optional

import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "gymnasium is required for GomokuEnv. Install it with `pip install gymnasium`."
    ) from exc

from .encoding import encode
from .game import GomokuGame


class GomokuEnv(gym.Env):
    """Single-agent Gymnasium environment for self-play Gomoku training.

    Observations are always given from the perspective of the player about to
    move: channel 0 marks that player's stones, channel 1 marks the
    opponent's stones, channel 2 is all-ones if that player is Black (moved
    first) else all-zeros. This lets one network play both sides in self-play.

    Rewards are from the perspective of the player who just made the move
    that produced the transition: +1 for winning, -1 for placing a stone in
    an already-occupied cell (illegal move, episode ends immediately), 0 for
    a draw or a non-terminal move.
    """

    metadata = {"render_modes": ["human", "ansi"]}

    def __init__(
        self,
        board_size: int = 15,
        win_length: int = 5,
        render_mode: Optional[str] = None,
    ):
        super().__init__()
        self.game = GomokuGame(board_size=board_size, win_length=win_length)
        self.board_size = board_size
        self.render_mode = render_mode

        n_cells = board_size * board_size
        self.action_space = spaces.Discrete(n_cells)
        self.observation_space = spaces.Box(
            low=0, high=1, shape=(3, board_size, board_size), dtype=np.int8
        )

    def _obs(self) -> np.ndarray:
        return encode(self.game)

    def action_masks(self) -> np.ndarray:
        """Boolean mask of legal actions; compatible with sb3-contrib MaskablePPO."""
        return self.game.valid_moves_mask()

    def reset(self, *, seed: Optional[int] = None, options: Optional[dict] = None):
        super().reset(seed=seed)
        self.game.reset()
        obs = self._obs()
        info = {"action_mask": self.action_masks()}
        if self.render_mode == "human":
            self.render()
        return obs, info

    def step(self, action: int):
        if not self.game.is_valid_move(action):
            obs = self._obs()
            info = {"action_mask": self.action_masks(), "invalid_move": True}
            return obs, -1.0, True, False, info

        mover = self.game.current_player
        result = self.game.step(action)

        if result.done:
            reward = 0.0 if result.winner is None else (1.0 if result.winner == mover else -1.0)
        else:
            reward = 0.0

        obs = self._obs()
        info = {"action_mask": self.action_masks(), "last_move": self.game.last_move}
        if self.render_mode == "human":
            self.render()
        return obs, reward, result.done, False, info

    def render(self):
        text = self.game.render()
        if self.render_mode == "ansi":
            return text
        print(text)
        return None
