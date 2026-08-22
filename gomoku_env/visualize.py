from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

import numpy as np

from .game import BLACK, GomokuGame


def boards_from_moves(
    moves: Sequence[Tuple[int, int]], board_size: int, win_length: int = 5
) -> List[np.ndarray]:
    """Replays (row, col) moves (Black first, alternating) and returns the
    board snapshot after each move."""
    game = GomokuGame(board_size, win_length)
    snapshots = []
    for row, col in moves:
        game.step(row * board_size + col)
        snapshots.append(game.board.copy())
    return snapshots


def _draw_board(ax, board: np.ndarray, board_size: int, last_move: Optional[Tuple[int, int]], move_no: int):
    from matplotlib.patches import Circle

    ax.clear()
    margin = 0.6
    ax.set_xlim(-margin, board_size - 1 + margin)
    ax.set_ylim(-margin, board_size - 1 + margin)
    ax.set_aspect("equal")
    ax.invert_yaxis()
    ax.set_facecolor("#DEB887")
    ax.set_xticks(range(board_size))
    ax.set_yticks(range(board_size))
    ax.set_xticklabels([])
    ax.set_yticklabels([])
    ax.tick_params(length=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.grid(True, color="black", linewidth=0.7)

    for r in range(board_size):
        for c in range(board_size):
            v = board[r, c]
            if v == 0:
                continue
            color = "black" if v == BLACK else "white"
            ax.add_patch(Circle((c, r), 0.42, facecolor=color, edgecolor="black", linewidth=1, zorder=3))

    if last_move is not None:
        r, c = last_move
        ax.add_patch(Circle((c, r), 0.13, facecolor="red", edgecolor="none", zorder=4))

    ax.set_title(f"move {move_no}")


def animate_game(
    moves: Sequence[Tuple[int, int]],
    board_size: int,
    win_length: int = 5,
    interval_ms: int = 500,
):
    """Returns a matplotlib FuncAnimation replaying `moves` one at a time.

    In a notebook, display it with:
        from IPython.display import HTML
        HTML(animate_game(moves, board_size).to_jshtml())
    """
    import matplotlib.pyplot as plt
    from matplotlib.animation import FuncAnimation

    snapshots = boards_from_moves(moves, board_size, win_length)
    fig, ax = plt.subplots(figsize=(5, 5))

    def update(i):
        _draw_board(ax, snapshots[i], board_size, moves[i], i + 1)
        return ax.patches

    anim = FuncAnimation(fig, update, frames=len(snapshots), interval=interval_ms, repeat=False)
    plt.close(fig)
    return anim
