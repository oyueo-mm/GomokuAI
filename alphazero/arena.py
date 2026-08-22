from __future__ import annotations

import numpy as np

from gomoku_env.game import BLACK, GomokuGame

from .config import AlphaZeroConfig
from .mcts import MCTSTree, run_search


def play_game(
    evaluator_a,
    evaluator_b,
    config: AlphaZeroConfig,
    rng: np.random.Generator,
    a_is_black: bool,
    record_moves: bool = False,
):
    """Plays one game (no root noise; the first config.arena_opening_moves moves are
    sampled at temperature=1 so repeated matches between the same two nets don't all
    play out identically, then it's greedy argmax). Returns 'a', 'b', or 'draw'.

    If record_moves is True, returns (result, moves) instead, where moves is
    the ordered list of (row, col) played (Black first, alternating) — enough
    to replay/visualize the game later (see gomoku_env.visualize).
    """
    game = GomokuGame(config.board_size, config.win_length)
    arena_config = AlphaZeroConfig(**{**config.__dict__, "num_simulations": config.arena_num_simulations})
    moves = [] if record_moves else None
    move_count = 0

    while not game.done:
        current_is_a = (game.current_player == BLACK) == a_is_black
        evaluator = evaluator_a if current_is_a else evaluator_b
        tree = MCTSTree(arena_config, rng, add_root_noise=False)
        tree.set_root(game)
        run_search(tree, evaluator, arena_config)
        temperature = 1.0 if move_count < config.arena_opening_moves else 0.0
        action, _ = tree.root_policy(temperature=temperature)
        game.step(action)
        move_count += 1
        if record_moves:
            moves.append(game.last_move)

    if game.winner is None:
        result = "draw"
    else:
        winner_is_a = (game.winner == BLACK) == a_is_black
        result = "a" if winner_is_a else "b"

    return (result, moves) if record_moves else result


def play_match(evaluator_a, evaluator_b, config: AlphaZeroConfig, rng: np.random.Generator) -> float:
    """Plays config.arena_games games, alternating colors. Returns a's win rate
    (draws count as half a win, matching standard AlphaZero gating practice)."""
    a_wins = 0.0
    for i in range(config.arena_games):
        a_is_black = i % 2 == 0
        result = play_game(evaluator_a, evaluator_b, config, rng, a_is_black)
        if result == "a":
            a_wins += 1.0
        elif result == "draw":
            a_wins += 0.5
    return a_wins / config.arena_games
