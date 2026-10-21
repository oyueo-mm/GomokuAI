"""Regression tests for action bounds and episode termination."""

import numpy as np
import pytest

from gomoku_env.game import GomokuGame, InvalidMoveError


@pytest.mark.parametrize("action", [-1, -9, 81, 120, 1.5, True, np.int64(-1)])
def test_invalid_actions_do_not_change_board(action):
    game = GomokuGame(board_size=9, win_length=5)
    before = game.board.copy()
    assert not game.is_valid_move(action)
    with pytest.raises(InvalidMoveError):
        game.step(action)
    assert np.array_equal(game.board, before)
    assert game.move_count == 0


def test_numpy_integer_is_supported():
    game = GomokuGame(board_size=9, win_length=5)
    game.step(np.int64(40))
    assert game.board[4, 4] == 1


def test_illegal_env_action_terminates_until_reset():
    pytest.importorskip("gymnasium")
    from gomoku_env.env import GomokuEnv
    env = GomokuEnv(board_size=9, win_length=5)
    env.reset()
    _, reward, done, _, info = env.step(-1)
    assert (reward, done, info["invalid_move"]) == (-1.0, True, True)
    assert env.game.move_count == 0
    with pytest.raises(RuntimeError):
        env.step(0)
    env.reset()
    _, reward, done, _, info = env.step(0)
    assert not done and reward == 0.0


def test_env_cannot_step_after_winner():
    pytest.importorskip("gymnasium")
    from gomoku_env.env import GomokuEnv
    env = GomokuEnv(board_size=9, win_length=5)
    env.reset()
    for action in [0, 9, 1, 10, 2, 11, 3, 12, 4]:
        _, _, done, _, _ = env.step(action)
    assert done
    with pytest.raises(RuntimeError):
        env.step(50)
