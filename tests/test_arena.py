import numpy as np

from alphazero.arena import play_game, play_match
from alphazero.config import AlphaZeroConfig
from alphazero.evaluator import DummyEvaluator


def make_config():
    return AlphaZeroConfig(
        board_size=4, win_length=3, num_simulations=8, sim_batch=4,
        arena_num_simulations=8, arena_games=4,
    )


def test_play_game_returns_valid_result():
    config = make_config()
    rng = np.random.default_rng(0)
    a = DummyEvaluator(config.action_size, np.random.default_rng(1))
    b = DummyEvaluator(config.action_size, np.random.default_rng(2))
    result = play_game(a, b, config, rng, a_is_black=True)
    assert result in ("a", "b", "draw")


def test_play_match_win_rate_in_range():
    config = make_config()
    rng = np.random.default_rng(0)
    a = DummyEvaluator(config.action_size, np.random.default_rng(1))
    b = DummyEvaluator(config.action_size, np.random.default_rng(2))
    win_rate = play_match(a, b, config, rng)
    assert 0.0 <= win_rate <= 1.0
