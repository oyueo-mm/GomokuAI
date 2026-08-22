import numpy as np

from alphazero.config import AlphaZeroConfig
from alphazero.evaluator import DummyEvaluator
from alphazero.mcts import MCTSTree, run_search
from gomoku_env.game import GomokuGame


def make_config(**overrides):
    defaults = dict(board_size=5, win_length=4, num_simulations=32, sim_batch=4)
    defaults.update(overrides)
    return AlphaZeroConfig(**defaults)


def test_search_runs_and_picks_legal_move():
    config = make_config()
    rng = np.random.default_rng(0)
    evaluator = DummyEvaluator(config.action_size, rng)
    game = GomokuGame(config.board_size, config.win_length)

    tree = MCTSTree(config, rng)
    tree.set_root(game)
    run_search(tree, evaluator, config)

    action, policy = tree.root_policy(temperature=1.0)
    assert game.is_valid_move(action)
    assert abs(policy.sum() - 1.0) < 1e-5
    assert policy[action] > 0
    # total real visits at root should equal num_simulations
    assert sum(c.visit_count for c in tree.root.children.values()) == config.num_simulations


def test_root_policy_greedy_matches_max_visits():
    config = make_config(num_simulations=40, sim_batch=4)
    rng = np.random.default_rng(1)
    evaluator = DummyEvaluator(config.action_size, rng)
    game = GomokuGame(config.board_size, config.win_length)

    tree = MCTSTree(config, rng)
    tree.set_root(game)
    run_search(tree, evaluator, config)

    action, _ = tree.root_policy(temperature=0.0)
    best_by_visits = max(tree.root.children.items(), key=lambda kv: kv[1].visit_count)[0]
    assert action == best_by_visits


def test_full_self_play_game_terminates_and_masks_illegal_moves():
    config = make_config(board_size=4, win_length=3, num_simulations=16, sim_batch=4, temperature_moves=2)
    rng = np.random.default_rng(2)
    evaluator = DummyEvaluator(config.action_size, rng)
    game = GomokuGame(config.board_size, config.win_length)

    moves = 0
    while not game.done and moves < config.action_size:
        tree = MCTSTree(config, rng)
        tree.set_root(game)
        run_search(tree, evaluator, config)
        temp = 1.0 if moves < config.temperature_moves else 0.0
        action, policy = tree.root_policy(temperature=temp)
        assert game.is_valid_move(action)
        assert np.all(policy[~game.valid_moves_mask()] == 0)
        game.step(action)
        moves += 1
    assert game.done or moves == config.action_size


def test_no_root_noise_is_deterministic_given_same_dummy_values():
    # With add_root_noise=False and a deterministic (fixed-seed) evaluator,
    # two independent searches on the same position should agree on the argmax move.
    config = make_config(num_simulations=24, sim_batch=4)

    def run_once():
        rng = np.random.default_rng(123)
        evaluator = DummyEvaluator(config.action_size, np.random.default_rng(999))
        game = GomokuGame(config.board_size, config.win_length)
        tree = MCTSTree(config, rng, add_root_noise=False)
        tree.set_root(game)
        run_search(tree, evaluator, config)
        return tree.root_policy(temperature=0.0)[0]

    assert run_once() == run_once()
