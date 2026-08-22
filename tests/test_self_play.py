import numpy as np

from alphazero.config import AlphaZeroConfig
from alphazero.evaluator import DummyEvaluator
from alphazero.self_play import SelfPlayBatch, generate_self_play_examples


def make_config(**overrides):
    defaults = dict(
        board_size=4, win_length=3, num_simulations=8, sim_batch=4,
        temperature_moves=2, games_per_iteration=6, parallel_games=3,
    )
    defaults.update(overrides)
    return AlphaZeroConfig(**defaults)


def test_self_play_batch_produces_examples_for_every_move():
    config = make_config()
    rng = np.random.default_rng(0)
    evaluator = DummyEvaluator(config.action_size, rng)

    batch = SelfPlayBatch(evaluator, config, num_games=3, rng=rng)
    examples = batch.play()

    assert all(f for f in batch.finished)
    assert len(examples) == sum(len(h) for h in batch.histories)
    for ex in examples:
        assert ex.state.shape == (3, config.board_size, config.board_size)
        assert ex.policy.shape == (config.action_size,)
        assert ex.value in (-1.0, 0.0, 1.0)


def test_generate_self_play_examples_respects_games_per_iteration():
    config = make_config(games_per_iteration=5, parallel_games=2)
    rng = np.random.default_rng(1)
    evaluator = DummyEvaluator(config.action_size, rng)

    examples = generate_self_play_examples(evaluator, config, rng)
    assert len(examples) > 0
