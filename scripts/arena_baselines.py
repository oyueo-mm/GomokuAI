"""Deterministic-seeded, alternating-color baseline arena for GomokuAI.

Run from repository root: python -m scripts.arena_baselines --games 4
"""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from time import perf_counter

import numpy as np

from gomoku_env.game import BLACK, GomokuGame
from gomoku_env.search_agents import choose_action


ALGORITHMS = ("random", "tactical", "alphabeta")


def run_match(agent_a: str, agent_b: str, games: int = 4, size: int = 9, depth: int = 2, seed: int = 42) -> list[dict]:
    if games < 2 or games % 2 != 0:
        raise ValueError("Games must be even and at least 2 for alternating colors")
    if size not in (9, 13, 15):
        raise ValueError("Board size must be 9, 13, or 15")
    if agent_a not in ALGORITHMS or agent_b not in ALGORITHMS:
        raise ValueError("Unsupported baseline algorithm")
    rng = np.random.default_rng(seed)
    results = []
    for game_number in range(games):
        game = GomokuGame(size, 5)
        color_a = BLACK if game_number % 2 == 0 else -BLACK
        elapsed = {"a": 0.0, "b": 0.0}
        nodes = {"a": 0, "b": 0}
        turns = {"a": 0, "b": 0}
        start = perf_counter()
        while not game.done:
            current = "a" if game.current_player == color_a else "b"
            algorithm = agent_a if current == "a" else agent_b
            decision = choose_action(game, algorithm, rng, depth=depth)
            assert game.is_valid_move(decision.action), f"Illegal move from {algorithm}"
            game.step(decision.action)
            elapsed[current] += decision.seconds
            nodes[current] += decision.nodes
            turns[current] += 1
        winner = "draw" if game.winner is None else "a" if game.winner == color_a else "b"
        results.append({"game": game_number + 1, "a_color": "black" if color_a == BLACK else "white", "winner": winner, "moves": game.move_count, "a_moves": turns["a"], "b_moves": turns["b"], "a_seconds": round(elapsed["a"], 5), "b_seconds": round(elapsed["b"], 5), "a_nodes": nodes["a"], "b_nodes": nodes["b"], "total_seconds": round(perf_counter() - start, 4)})
    return results


def summarize(results: list[dict]) -> dict:
    wins_a = sum(x["winner"] == "a" for x in results)
    wins_b = sum(x["winner"] == "b" for x in results)
    draws = len(results) - wins_a - wins_b
    turns_a = sum(x["a_moves"] for x in results)
    turns_b = sum(x["b_moves"] for x in results)
    return {"games": len(results), "a_wins": wins_a, "b_wins": wins_b, "draws": draws, "a_score_rate": (wins_a + 0.5 * draws) / len(results), "a_avg_move_seconds": sum(x["a_seconds"] for x in results) / max(turns_a, 1), "b_avg_move_seconds": sum(x["b_seconds"] for x in results) / max(turns_b, 1)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--a", choices=ALGORITHMS, default="tactical")
    parser.add_argument("--b", choices=ALGORITHMS, default="random")
    parser.add_argument("--games", type=int, default=4)
    parser.add_argument("--size", type=int, choices=(9, 13, 15), default=9)
    parser.add_argument("--depth", type=int, choices=(1, 2, 3), default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=Path("results/baseline_arena.csv"))
    args = parser.parse_args()
    rows = run_match(args.a, args.b, args.games, args.size, args.depth, args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({"a": args.a, "b": args.b, **summarize(rows)}, ensure_ascii=False, indent=2))
    print(f"CSV saved to {args.output}")


if __name__ == "__main__":
    main()
