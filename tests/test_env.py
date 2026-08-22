import numpy as np

from gomoku_env.env import GomokuEnv


def test_reset_shapes():
    env = GomokuEnv(board_size=9, win_length=5)
    obs, info = env.reset()
    assert obs.shape == (3, 9, 9)
    assert obs.dtype == np.int8
    assert info["action_mask"].sum() == 81
    # First player to move is Black -> color plane is all ones.
    assert (obs[2] == 1).all()


def test_step_updates_perspective():
    env = GomokuEnv(board_size=9, win_length=5)
    env.reset()
    obs, reward, terminated, truncated, info = env.step(0)
    assert reward == 0.0
    assert not terminated
    assert not truncated
    # After Black moves, it's White's turn -> color plane is all zeros,
    # and the stone Black just placed shows up in the opponent channel.
    assert (obs[2] == 0).all()
    assert obs[1, 0, 0] == 1
    assert info["action_mask"][0] == False  # noqa: E712


def test_win_gives_positive_reward_to_mover():
    env = GomokuEnv(board_size=9, win_length=5)
    env.reset()
    moves = [0, 9, 1, 10, 2, 11, 3, 12, 4]
    reward = terminated = None
    for action in moves:
        _, reward, terminated, _, info = env.step(action)
    assert terminated
    assert reward == 1.0


def test_illegal_move_ends_episode_with_penalty():
    env = GomokuEnv(board_size=9, win_length=5)
    env.reset()
    env.step(0)
    _, reward, terminated, _, info = env.step(0)
    assert terminated
    assert reward == -1.0
    assert info["invalid_move"]


def test_full_random_game_terminates():
    rng = np.random.default_rng(0)
    env = GomokuEnv(board_size=9, win_length=5)
    obs, info = env.reset()
    terminated = False
    steps = 0
    while not terminated and steps < 81:
        legal = np.flatnonzero(info["action_mask"])
        action = rng.choice(legal)
        obs, reward, terminated, truncated, info = env.step(int(action))
        steps += 1
    assert terminated
