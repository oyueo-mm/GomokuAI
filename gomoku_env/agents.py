"""Deterministic tactical baseline for freestyle Gomoku.

This agent is a non-neural reference opponent.  It wins in one move when
possible, blocks an opponent win in one move, then ranks local threats.
"""
from __future__ import annotations

import numpy as np

from .game import GomokuGame

DIRECTIONS = ((1, 0), (0, 1), (1, 1), (1, -1))


def _run_and_ends(board: np.ndarray, row: int, col: int, player: int, dr: int, dc: int) -> tuple[int, int]:
    size = board.shape[0]
    count = 1
    open_ends = 0
    for sign in (1, -1):
        r, c = row + sign * dr, col + sign * dc
        while 0 <= r < size and 0 <= c < size and board[r, c] == player:
            count += 1
            r += sign * dr
            c += sign * dc
        if 0 <= r < size and 0 <= c < size and board[r, c] == 0:
            open_ends += 1
    return count, open_ends


def _would_win(board: np.ndarray, row: int, col: int, player: int, win_length: int) -> bool:
    return any(_run_and_ends(board, row, col, player, dr, dc)[0] >= win_length for dr, dc in DIRECTIONS)


def _threat_score(board: np.ndarray, row: int, col: int, player: int, win_length: int) -> float:
    score = 0.0
    for dr, dc in DIRECTIONS:
        count, open_ends = _run_and_ends(board, row, col, player, dr, dc)
        remaining = win_length - count
        if remaining <= 0:
            score += 1_000_000
        elif remaining == 1:
            score += 25_000 if open_ends == 2 else 4_000 if open_ends == 1 else 0
        elif remaining == 2:
            score += 1_000 if open_ends == 2 else 100 if open_ends == 1 else 0
        elif remaining == 3:
            score += 50 if open_ends == 2 else 8 if open_ends == 1 else 0
        else:
            score += count if open_ends else 0
    return score


def choose_move(game: GomokuGame) -> int:
    """Return a legal flattened action for the side to move (no model required)."""
    if game.done:
        raise ValueError("Cannot choose a move after the game has ended.")
    board = game.board
    size = game.board_size
    stones = np.argwhere(board != 0)
    if len(stones) == 0:
        center = size // 2
        return center * size + center

    # Limit ordinary evaluation to cells near existing stones while retaining
    # a deterministic choice in corner cases and on small boards.
    neighbors: set[tuple[int, int]] = set()
    for row, col in stones:
        for dr in range(-2, 3):
            for dc in range(-2, 3):
                r, c = int(row) + dr, int(col) + dc
                if 0 <= r < size and 0 <= c < size and board[r, c] == 0:
                    neighbors.add((r, c))
    if not neighbors:
        neighbors = {tuple(map(int, p)) for p in np.argwhere(board == 0)}
    if not neighbors:
        raise ValueError("No legal moves remain.")

    candidates = sorted(neighbors)
    player = game.current_player
    opponent = -player
    center = (size - 1) / 2
    priority = lambda p: ((p[0] - center) ** 2 + (p[1] - center) ** 2, p[0], p[1])

    wins = [p for p in candidates if _would_win(board, p[0], p[1], player, game.win_length)]
    if wins:
        row, col = min(wins, key=priority)
        return row * size + col

    blocks = [p for p in candidates if _would_win(board, p[0], p[1], opponent, game.win_length)]
    if blocks:
        row, col = min(blocks, key=lambda p: (-_threat_score(board, *p, player, game.win_length), *priority(p)))
        return row * size + col

    row, col = max(candidates, key=lambda p: (_threat_score(board, *p, player, game.win_length) + 1.1 * _threat_score(board, *p, opponent, game.win_length), -priority(p)[0], -p[0], -p[1]))
    return row * size + col
