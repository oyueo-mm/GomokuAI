import numpy as np

from alphazero.replay_buffer import ReplayBuffer
from alphazero.self_play import Example


def make_examples(n, board_size=5):
    rng = np.random.default_rng(0)
    examples = []
    for _ in range(n):
        state = rng.integers(0, 2, size=(3, board_size, board_size)).astype(np.int8)
        policy = np.zeros(board_size * board_size, dtype=np.float32)
        policy[0] = 1.0
        examples.append(Example(state=state, policy=policy, value=1.0))
    return examples


def test_add_and_sample():
    rng = np.random.default_rng(1)
    buffer = ReplayBuffer(capacity=100, rng=rng)
    buffer.add_examples(make_examples(10), augment=False)
    assert len(buffer) == 10
    states, policies, values = buffer.sample(4)
    assert states.shape == (4, 3, 5, 5)
    assert policies.shape == (4, 25)
    assert values.shape == (4,)


def test_capacity_evicts_oldest():
    rng = np.random.default_rng(2)
    buffer = ReplayBuffer(capacity=5, rng=rng)
    buffer.add_examples(make_examples(10), augment=False)
    assert len(buffer) == 5


def test_save_and_load_roundtrip(tmp_path):
    rng = np.random.default_rng(3)
    buffer = ReplayBuffer(capacity=50, rng=rng)
    buffer.add_examples(make_examples(7), augment=False)
    path = str(tmp_path / "buffer.npz")
    buffer.save(path)

    loaded = ReplayBuffer(capacity=50, rng=np.random.default_rng(4))
    loaded.load(path)
    assert len(loaded) == 7
    states, policies, values = loaded.sample(3)
    assert states.shape == (3, 3, 5, 5)
