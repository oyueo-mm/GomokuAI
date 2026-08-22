import pytest

from gomoku_env.game import BLACK, GomokuGame, InvalidMoveError, WHITE


def test_reset_state():
    game = GomokuGame(board_size=9, win_length=5)
    assert game.board.sum() == 0
    assert game.current_player == BLACK
    assert not game.done


def test_horizontal_win():
    game = GomokuGame(board_size=9, win_length=5)
    # Black plays 0..3 in row 0, White plays elsewhere in row 1.
    moves = [0, 9, 1, 10, 2, 11, 3, 12, 4]
    result = None
    for action in moves:
        result = game.step(action)
    assert result.done
    assert result.winner == BLACK


def test_vertical_win():
    game = GomokuGame(board_size=9, win_length=5)
    # Black plays column 0 rows 0..4, White plays column 1.
    moves = [0, 1, 9, 10, 18, 19, 27, 28, 36]
    result = None
    for action in moves:
        result = game.step(action)
    assert result.done
    assert result.winner == BLACK


def test_diagonal_win():
    game = GomokuGame(board_size=9, win_length=5)
    size = 9
    black_cells = [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4)]
    white_cells = [(0, 1), (1, 2), (2, 3), (3, 4)]
    result = None
    for i in range(5):
        r, c = black_cells[i]
        result = game.step(r * size + c)
        if i < 4:
            r, c = white_cells[i]
            result = game.step(r * size + c)
    assert result.done
    assert result.winner == BLACK


def test_anti_diagonal_win():
    game = GomokuGame(board_size=9, win_length=5)
    size = 9
    black_cells = [(0, 4), (1, 3), (2, 2), (3, 1), (4, 0)]
    white_cells = [(1, 4), (2, 4), (3, 4), (4, 4)]
    result = None
    for i in range(5):
        r, c = black_cells[i]
        result = game.step(r * size + c)
        if i < 4:
            r, c = white_cells[i]
            result = game.step(r * size + c)
    assert result.done
    assert result.winner == BLACK


def test_invalid_move_raises():
    game = GomokuGame(board_size=9, win_length=5)
    game.step(0)
    with pytest.raises(InvalidMoveError):
        game.step(0)


def test_step_after_done_raises():
    game = GomokuGame(board_size=9, win_length=5)
    moves = [0, 9, 1, 10, 2, 11, 3, 12, 4]
    for action in moves:
        game.step(action)
    with pytest.raises(InvalidMoveError):
        game.step(50)


def test_draw_on_full_board():
    # 3x3 board with win_length=5 can never be won; must end in a draw.
    game = GomokuGame(board_size=3, win_length=5)
    result = None
    for action in range(9):
        result = game.step(action)
    assert result.done
    assert result.winner is None


def test_clone_is_independent():
    game = GomokuGame(board_size=9, win_length=5)
    game.step(0)
    clone = game.clone()
    clone.step(1)
    assert game.board[0, 1] == 0
    assert clone.board[0, 1] == WHITE
