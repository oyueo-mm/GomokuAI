"""Run a deliberately tiny AlphaZero integration test in the ORIGINAL repository.

Requires the existing `alphazero/` package and torch. It does not establish
playing strength; it checks whether a complete train/evaluate iteration finishes.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoints", type=Path, default=Path("checkpoints/smoke_v02"))
    args = parser.parse_args()
    try:
        from alphazero.config import AlphaZeroConfig
        from alphazero.pipeline import run_training_loop
    except ImportError as exc:
        raise SystemExit("Original alphazero/ package not found. Run this script inside the full GomokuAI repository, not the standalone web-only ZIP.") from exc
    config = AlphaZeroConfig(board_size=5, win_length=4, num_channels=16, num_res_blocks=1, num_simulations=12, sim_batch=3, games_per_iteration=4, parallel_games=2, buffer_size=512, batch_size=8, train_steps_per_iteration=3, arena_games=2, arena_num_simulations=8, total_iterations=1, checkpoint_dir=str(args.checkpoints))
    run_training_loop(config, resume=False)
    expected = ["latest.pt", "best.pt", "buffer.npz", "log.csv"]
    missing = [name for name in expected if not (args.checkpoints / name).exists()]
    if missing:
        raise SystemExit(f"SMOKE FAILED: missing files: {missing}")
    print("SMOKE PASS: artifacts created. Model strength NOT validated.")


if __name__ == "__main__":
    main()
