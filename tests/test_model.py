import numpy as np
import torch

from alphazero.config import AlphaZeroConfig
from alphazero.evaluator import NetEvaluator
from alphazero.model import GomokuNet


def make_config():
    return AlphaZeroConfig(board_size=5, win_length=4, num_channels=8, num_res_blocks=2)


def test_forward_shapes():
    config = make_config()
    model = GomokuNet(config)
    batch = torch.zeros(4, 3, config.board_size, config.board_size)
    policy_logits, value = model(batch)
    assert policy_logits.shape == (4, config.action_size)
    assert value.shape == (4,)
    assert torch.all(value.abs() <= 1.0)


def test_predict_is_a_probability_distribution():
    config = make_config()
    model = GomokuNet(config)
    batch = torch.randn(3, 3, config.board_size, config.board_size)
    probs, value = model.predict(batch)
    assert torch.allclose(probs.sum(dim=-1), torch.ones(3), atol=1e-5)
    assert torch.all(probs >= 0)


def test_net_evaluator_matches_manual_forward():
    config = make_config()
    model = GomokuNet(config)
    evaluator = NetEvaluator(model, device="cpu")
    rng = np.random.default_rng(0)
    states = [rng.integers(0, 2, size=(3, config.board_size, config.board_size)).astype(np.int8) for _ in range(2)]

    priors, values = evaluator.evaluate_batch(states)
    assert priors.shape == (2, config.action_size)
    assert values.shape == (2,)
    assert np.allclose(priors.sum(axis=-1), 1.0, atol=1e-5)
