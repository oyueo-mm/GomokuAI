from __future__ import annotations

import copy
import csv
import time
from pathlib import Path

import numpy as np
import torch

from .arena import play_match
from .config import AlphaZeroConfig
from .evaluator import NetEvaluator
from .model import GomokuNet
from .replay_buffer import ReplayBuffer
from .self_play import generate_self_play_examples
from .train import train_steps

LATEST_PATH = "latest.pt"
BEST_PATH = "best.pt"
BUFFER_PATH = "buffer.npz"
LOG_PATH = "log.csv"


def _device() -> str:
    return "cuda" if torch.cuda.is_available() else "cpu"


def _make_optimizer(model, config: AlphaZeroConfig):
    return torch.optim.SGD(
        model.parameters(),
        lr=config.learning_rate,
        momentum=0.9,
        weight_decay=config.weight_decay,
    )


def _log_row(checkpoint_dir: Path, row: dict):
    path = checkpoint_dir / LOG_PATH
    is_new = not path.exists()
    with open(path, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(row.keys()))
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def run_training_loop(config: AlphaZeroConfig, resume: bool = True):
    """Main AlphaZero loop: self-play (best net) -> train candidate -> arena
    gate -> promote. Checkpoints after every iteration so a Colab session
    that gets disconnected can resume exactly where it left off.
    """
    device = _device()
    checkpoint_dir = Path(config.checkpoint_dir)
    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(config.seed)

    model = GomokuNet(config).to(device)
    best_model = GomokuNet(config).to(device)
    optimizer = _make_optimizer(model, config)
    buffer = ReplayBuffer(config.buffer_size, rng)
    start_iteration = 0

    latest_path = checkpoint_dir / LATEST_PATH
    best_path = checkpoint_dir / BEST_PATH
    buffer_path = checkpoint_dir / BUFFER_PATH

    if resume and latest_path.exists():
        checkpoint = torch.load(latest_path, map_location=device)
        model.load_state_dict(checkpoint["model_state"])
        optimizer.load_state_dict(checkpoint["optimizer_state"])
        start_iteration = checkpoint["iteration"] + 1
        best_model.load_state_dict(torch.load(best_path, map_location=device))
        if buffer_path.exists():
            buffer.load(str(buffer_path))
        print(f"Resumed from iteration {start_iteration} ({len(buffer)} buffered examples).")
    else:
        best_model.load_state_dict(model.state_dict())
        torch.save(model.state_dict(), best_path)
        print("Starting fresh run.")

    best_evaluator = NetEvaluator(best_model, device)
    candidate_evaluator = NetEvaluator(model, device)

    for iteration in range(start_iteration, config.total_iterations):
        t0 = time.time()

        examples = generate_self_play_examples(best_evaluator, config, rng)
        buffer.add_examples(examples)
        t_selfplay = time.time() - t0

        losses = train_steps(model, optimizer, buffer, config, device)
        t_train = time.time() - t0 - t_selfplay

        _apply_lr_schedule(optimizer, config, iteration)

        win_rate = play_match(candidate_evaluator, best_evaluator, config, rng)
        promoted = win_rate >= config.arena_win_rate_threshold
        if promoted:
            best_model.load_state_dict(model.state_dict())

        torch.save(best_model.state_dict(), best_path)
        torch.save(
            {
                "iteration": iteration,
                "model_state": model.state_dict(),
                "optimizer_state": optimizer.state_dict(),
            },
            latest_path,
        )
        buffer.save(str(buffer_path))

        row = {
            "iteration": iteration,
            "buffer_size": len(buffer),
            "policy_loss": losses["policy_loss"],
            "value_loss": losses["value_loss"],
            "policy_target_entropy": losses["policy_target_entropy"],
            "arena_win_rate": win_rate,
            "promoted": promoted,
            "selfplay_seconds": round(t_selfplay, 1),
            "train_seconds": round(t_train, 1),
        }
        _log_row(checkpoint_dir, row)
        print(
            f"[iter {iteration}] buffer={len(buffer)} "
            f"policy_loss={losses['policy_loss']:.3f} value_loss={losses['value_loss']:.3f} "
            f"target_entropy={losses['policy_target_entropy']:.3f} "
            f"arena_win_rate={win_rate:.2f} promoted={promoted} "
            f"(selfplay {t_selfplay:.0f}s, train {t_train:.0f}s)"
        )


def _apply_lr_schedule(optimizer, config: AlphaZeroConfig, iteration: int):
    decay_steps = sum(1 for m in config.lr_milestones if iteration >= m)
    new_lr = config.learning_rate * (0.1 ** decay_steps)
    for group in optimizer.param_groups:
        group["lr"] = new_lr
