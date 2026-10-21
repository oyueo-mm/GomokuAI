import numpy as np
import pytest
from alphazero.config import AlphaZeroConfig
from alphazero.mcts import MCTSTree
from gomoku_env.game import GomokuGame


def test_duplicate_leaf_expansion_preserves_children():
    config = AlphaZeroConfig(board_size=5, win_length=4)
    tree = MCTSTree(config, np.random.default_rng(0), add_root_noise=False)
    tree.set_root(GomokuGame(5, 4))
    _, game, path, _ = tree.select_leaf()
    tree.expand_and_backup(path, game, np.ones(25), 0)
    tree.root._visits[0] = 7
    tree.expand_and_backup(path, game, np.ones(25), 0)
    assert tree.root._visits[0] == 7


@pytest.mark.parametrize('size,length', [(0, 5), (True, 1), (9, 0)])
def test_invalid_dimensions(size, length):
    with pytest.raises(ValueError):
        GomokuGame(size, length)


def test_zero_search_budget_rejected():
    with pytest.raises(ValueError):
        AlphaZeroConfig(num_simulations=0)
