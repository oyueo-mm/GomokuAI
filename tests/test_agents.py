from gomoku_env.game import GomokuGame, InvalidMoveError
from gomoku_env.agents import choose_move
import pytest


def test_center_opening():
    assert choose_move(GomokuGame(9, 5)) == 40


def test_win_immediately():
    game = GomokuGame(9, 5)
    for move in [0, 9, 1, 10, 2, 11, 3, 30]:
        game.step(move)
    assert choose_move(game) == 4


def test_block_immediate_threat():
    game = GomokuGame(9, 5)
    for move in [0, 36, 2, 37, 5, 38, 7, 39]:
        game.step(move)
    assert choose_move(game) == 40


def test_legal_midgame_move():
    game = GomokuGame(9, 5)
    for move in [40, 30, 41, 31]:
        game.step(move)
    assert game.is_valid_move(choose_move(game))


def test_no_move_after_finished():
    game = GomokuGame(5, 3)
    for move in [0, 5, 1, 6, 2]:
        game.step(move)
    with pytest.raises(ValueError):
        choose_move(game)


def test_invalid_coordinates_are_rejected():
    game = GomokuGame(9, 5)
    for action in [-1, 81, 100, 1.5, True]:
        assert not game.is_valid_move(action)
        with pytest.raises(InvalidMoveError):
            game.step(action)
    assert game.move_count == 0
    assert game.board.sum() == 0
