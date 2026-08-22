import numpy as np

from gomoku_env.visualize import animate_game, boards_from_moves


def test_boards_from_moves_matches_manual_replay():
    board_size, win_length = 5, 4
    moves = [(0, 0), (1, 0), (0, 1), (1, 1), (0, 2), (1, 2), (0, 3)]
    snapshots = boards_from_moves(moves, board_size, win_length)

    assert len(snapshots) == len(moves)
    # Black played (0,0),(0,1),(0,2),(0,3) on moves 0,2,4,6 -> after move 7 (index 6) Black has won.
    final_board = snapshots[-1]
    assert final_board[0, 0] == 1
    assert final_board[0, 3] == 1
    assert final_board[1, 0] == -1


def test_animate_game_builds_animation_object():
    board_size, win_length = 4, 3
    moves = [(0, 0), (1, 0), (0, 1), (1, 1), (0, 2)]
    anim = animate_game(moves, board_size, win_length, interval_ms=100)
    assert anim._save_count == len(moves)
