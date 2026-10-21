"""Evaluate a trusted, existing AlphaZero best.pt against a reference opponent.

Requires the original `alphazero/` package and a checkpoint trained with
matching board size and network dimensions. Does not retrain the model.
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from time import perf_counter

import numpy as np

from gomoku_env.game import BLACK, GomokuGame
from gomoku_env.search_agents import choose_action


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=Path("checkpoints/best.pt"))
    parser.add_argument("--size", type=int, default=9)
    parser.add_argument("--win-length", type=int, default=5)
    parser.add_argument("--channels", type=int, default=64)
    parser.add_argument("--blocks", type=int, default=6)
    parser.add_argument("--sims", type=int, default=32)
    parser.add_argument("--games", type=int, default=4)
    parser.add_argument("--opponent", choices=("random", "tactical", "alphabeta"), default="tactical")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=Path("results/alphazero_vs_baseline.csv"))
    args = parser.parse_args()
    if not args.checkpoint.is_file():
        raise SystemExit(f"Checkpoint missing: {args.checkpoint} — train and verify a model first.")
    if args.games < 2 or args.games % 2:
        raise SystemExit("--games must be an even integer >= 2")
    try:
        import torch
        from alphazero.config import AlphaZeroConfig
        from alphazero.evaluator import NetEvaluator
        from alphazero.mcts import MCTSTree, run_search
        from alphazero.model import GomokuNet
    except ImportError as exc:
        raise SystemExit("Requires the original alphazero/ package and PyTorch") from exc
    config = AlphaZeroConfig(board_size=args.size, win_length=args.win_length, num_channels=args.channels, num_res_blocks=args.blocks, num_simulations=args.sims, sim_batch=min(args.sims, 4))
    model = GomokuNet(config)
    # Only load checkpoints from the user's own trusted training runs.
    state = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    evaluator = NetEvaluator(model, device="cuda" if torch.cuda.is_available() else "cpu")
    rng = np.random.default_rng(args.seed)
    records = []
    for game_index in range(args.games):
        game = GomokuGame(args.size, args.win_length)
        az_color = BLACK if game_index % 2 == 0 else -BLACK
        az_seconds, az_turns = 0.0, 0
        while not game.done:
            if game.current_player == az_color:
                t0 = perf_counter()
                tree = MCTSTree(config, rng, add_root_noise=False)
                tree.set_root(game)
                run_search(tree, evaluator, config)
                action, _ = tree.root_policy(temperature=0.0)
                az_seconds += perf_counter() - t0
                az_turns += 1
            else:
                action = choose_action(game, args.opponent, rng).action
            if not game.is_valid_move(action):
                raise RuntimeError(f"Illegal move: {action}")
            game.step(action)
        outcome = "draw" if game.winner is None else ("alphazero" if game.winner == az_color else args.opponent)
        records.append({"game": game_index + 1, "az_color": "black" if az_color == BLACK else "white", "winner": outcome, "moves": game.move_count, "az_seconds": round(az_seconds, 4), "az_turns": az_turns})
        print(f"game {game_index + 1}/{args.games} winner={outcome} moves={game.move_count}", flush=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    wins = sum(x["winner"] == "alphazero" for x in records)
    draws = sum(x["winner"] == "draw" for x in records)
    print(f"AlphaZero score rate: {(wins + draws * .5) / len(records):.1%} (wins={wins}, draws={draws}), CSV={args.output}")
    print("Small matches are exploratory, not proof of playing strength.")


if __name__ == "__main__":
    main()
