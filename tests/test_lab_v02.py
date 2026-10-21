import numpy as np
import pytest

from gomoku_env.game import BLACK, WHITE, GomokuGame
from gomoku_env.search_agents import candidate_actions, choose_action, choose_alphabeta, rank_actions
from scripts.arena_baselines import run_match, summarize
from scripts.web_server import GameSession, new_session


def position(black_moves, white_moves, current_player=BLACK, size=9):
    game = GomokuGame(size, 5)
    for row, col in black_moves:
        game.board[row, col] = BLACK
    for row, col in white_moves:
        game.board[row, col] = WHITE
    game.move_count = len(black_moves) + len(white_moves)
    game.current_player = current_player
    return game


def test_empty_center():
    game = GomokuGame(9, 5)
    assert candidate_actions(game) == [40]
    for algorithm in ("tactical", "alphabeta"):
        assert choose_action(game, algorithm, np.random.default_rng(0)).action == 40
    assert game.is_valid_move(choose_action(game, "random", np.random.default_rng(0)).action)


def test_search_wins_now():
    game = position([(4, 1), (4, 2), (4, 3), (4, 4)], [(0, 0), (0, 2), (0, 4), (1, 6)])
    decision = choose_alphabeta(game, depth=2)
    assert decision.action in (4 * 9, 4 * 9 + 5)


def test_search_blocks_opponent_win():
    game = position([(2, 1), (2, 2), (2, 3), (2, 4)], [(0, 0), (0, 2), (0, 4), (1, 6)], WHITE)
    decision = choose_alphabeta(game, depth=2)
    assert decision.action in (2 * 9, 2 * 9 + 5)


def test_rank_legal_only():
    game = GomokuGame(9, 5)
    game.step(40)
    result = rank_actions(game)
    assert result
    assert all(game.is_valid_move(action) for action, _ in result)
    assert len({action for action, _ in result}) == len(result)


def test_session_turn_and_version():
    session = GameSession(9, BLACK, "tactical")
    state = session.play(4, 4, 0)
    assert state["version"] == 2
    assert state["history"][0]["by"] == "human"
    assert state["history"][1]["by"] == "ai"
    with pytest.raises(ValueError, match="Stale board"):
        session.play(0, 0, 0)


def test_white_moves_second():
    session = GameSession(9, WHITE, "tactical")
    assert len(session.history) == 1
    assert session.game.current_player == WHITE
    assert session.game.is_valid_move(40) is False


def test_invalid_session_parameters():
    with pytest.raises(ValueError):
        new_session(7, BLACK, "tactical", 2)
    with pytest.raises(ValueError):
        new_session(9, BLACK, "fake", 2)
    session = GameSession(9, BLACK, "random")
    with pytest.raises(ValueError):
        session.play(-1, 2, 0)
    with pytest.raises(ValueError):
        session.play(True, 2, 0)


def test_arena_alternates_colors():
    results = run_match("random", "random", games=2, size=9, seed=0)
    assert [r["a_color"] for r in results] == ["black", "white"]
    assert all(r["moves"] <= 81 for r in results)
    assert 0 <= summarize(results)["a_score_rate"] <= 1
