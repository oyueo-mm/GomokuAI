from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

BLACK = 1
WHITE = -1

_DIRECTIONS = ((1, 0), (0, 1), (1, 1), (1, -1))


class InvalidMoveError(Exception):
    pass


@dataclass
class StepResult:
    done: bool
    winner: Optional[int]  # BLACK, WHITE, or None (draw / not done)


class GomokuGame:
    """Pure game logic for free-style Gomoku (no renju forbidden-move rules).

    Board coordinates are (row, col), 0-indexed, flattened action = row * board_size + col.
    Stones are BLACK (1) or WHITE (-1); empty cells are 0. Black always moves first.
    """

    def __init__(self, board_size: int = 15, win_length: int = 5):
        if isinstance(board_size, bool) or not isinstance(board_size, int) or board_size < 1:
            raise ValueError("board_size must be a positive integer")
        if isinstance(win_length, bool) or not isinstance(win_length, int) or win_length < 1:
            raise ValueError("win_length must be a positive integer")
        self.board_size = board_size
        self.win_length = win_length
        self.reset()

    def reset(self) -> np.ndarray:
        self.board = np.zeros((self.board_size, self.board_size), dtype=np.int8)
        self.current_player = BLACK
        self.last_move: Optional[tuple] = None
        self.move_count = 0
        self.winner: Optional[int] = None
        self.done = False
        return self.board.copy()

    def valid_moves_mask(self) -> np.ndarray:
        return (self.board == 0).reshape(-1)

    def is_valid_move(self, action: int) -> bool:
        if isinstance(action, (bool, np.bool_)) or not isinstance(action, (int, np.integer)):
            return False
        if action < 0 or action >= self.board_size * self.board_size:
            return False
        row, col = divmod(int(action), self.board_size)
        return bool(self.board[row, col] == 0)

    def step(self, action: int) -> StepResult:
        if self.done:
            raise InvalidMoveError("Game already finished; call reset().")
        if not self.is_valid_move(action):
            raise InvalidMoveError(f"Action {action} is out of bounds or its cell is occupied.")

        row, col = divmod(action, self.board_size)
        player = self.current_player
        self.board[row, col] = player
        self.last_move = (row, col)
        self.move_count += 1

        if self._check_win(row, col, player):
            self.done = True
            self.winner = player
        elif self.move_count == self.board_size * self.board_size:
            self.done = True
            self.winner = None  # draw
        else:
            self.current_player = -player

        return StepResult(done=self.done, winner=self.winner)

    def _check_win(self, row: int, col: int, player: int) -> bool:
        for d_row, d_col in _DIRECTIONS:
            count = 1
            count += self._count_direction(row, col, d_row, d_col, player)
            count += self._count_direction(row, col, -d_row, -d_col, player)
            if count >= self.win_length:
                return True
        return False

    def _count_direction(self, row: int, col: int, d_row: int, d_col: int, player: int) -> int:
        count = 0
        r, c = row + d_row, col + d_col
        while (
            0 <= r < self.board_size
            and 0 <= c < self.board_size
            and self.board[r, c] == player
        ):
            count += 1
            r += d_row
            c += d_col
        return count

    def render(self) -> str:
        symbols = {0: ".", BLACK: "X", WHITE: "O"}
        header = "    " + " ".join(f"{c:2d}" for c in range(self.board_size))
        lines = [header]
        for r in range(self.board_size):
            row_str = "  ".join(symbols[int(self.board[r, c])] for c in range(self.board_size))
            lines.append(f"{r:2d}  {row_str}")
        return "\n".join(lines)

    def clone(self) -> "GomokuGame":
        clone = GomokuGame.__new__(GomokuGame)
        clone.board_size = self.board_size
        clone.win_length = self.win_length
        clone.board = self.board.copy()
        clone.current_player = self.current_player
        clone.last_move = self.last_move
        clone.move_count = self.move_count
        clone.winner = self.winner
        clone.done = self.done
        return clone
