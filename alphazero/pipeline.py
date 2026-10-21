from __future__ import annotations

import copy
from dataclasses import asdict
import csv
import json
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


def _atomic_save(value, path: Path):
    temporary = path.with_suffix('.pt.tmp')
    torch.save(value, temporary)
    temporary.replace(path)


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
    fields = list(row)
    if not is_new:
        with path.open(newline='') as f:
            reader = csv.DictReader(f)
            previous_fields = reader.fieldnames or []
            previous_rows = list(reader)
        fields = list(dict.fromkeys(previous_fields + fields))
        if fields != previous_fields:
            temporary = path.with_suffix('.csv.tmp')
            with temporary.open('w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fields)
                writer.writeheader()
                writer.writerows(previous_rows)
            temporary.replace(path)
    with open(path, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
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
    torch.manual_seed(config.seed)

    model = GomokuNet(config).to(device)
    best_model = GomokuNet(config).to(device)
    optimizer = _make_optimizer(model, config)
    buffer = ReplayBuffer(config.buffer_size, rng)
    start_iteration = 0

    latest_path = checkpoint_dir / LATEST_PATH
    best_path = checkpoint_dir / BEST_PATH
    buffer_path = checkpoint_dir / BUFFER_PATH

    if resume and latest_path.exists():
        # Replay tensors can be large: keep snapshot storage on CPU. Optimizer
        # load_state_dict moves optimizer tensors to their parameter devices.
        checkpoint = torch.load(latest_path, map_location='cpu', weights_only=True)
        saved_config = checkpoint.get("config", {})
        for key in ("board_size", "win_length", "num_channels", "num_res_blocks", "value_hidden_size", "seed"):
            if key in saved_config and saved_config[key] != getattr(config, key):
                raise ValueError(f"Resume configuration mismatch: {key}")
        model.load_state_dict(checkpoint["model_state"])
        optimizer.load_state_dict(checkpoint["optimizer_state"])
        start_iteration = checkpoint["iteration"] + 1
        best_model.load_state_dict(checkpoint.get('best_model_state') or torch.load(best_path, map_location=device))
        if 'buffer_state' in checkpoint:
            buffer.load_state_dict({key: value.cpu().numpy() for key, value in checkpoint['buffer_state'].items()})
        elif buffer_path.exists():
            buffer.load(str(buffer_path))
        if "numpy_rng" in checkpoint:
            rng.bit_generator.state = checkpoint["numpy_rng"]
            torch.set_rng_state(checkpoint["torch_rng"].cpu())
            if torch.cuda.is_available() and checkpoint.get("cuda_rng") is not None:
                torch.cuda.set_rng_state_all([state.cpu() for state in checkpoint["cuda_rng"]])
        print(f"Resumed from iteration {start_iteration} ({len(buffer)} buffered examples).")
    else:
        if latest_path.exists() or best_path.exists():
            raise FileExistsError("Use a fresh checkpoint directory or resume=True")
        best_model.load_state_dict(model.state_dict())
        _atomic_save(model.state_dict(), best_path)
        print("Starting fresh run.")

    (checkpoint_dir / 'run.json').write_text(json.dumps({'config': asdict(config), 'device': device, 'torch': str(torch.__version__), 'numpy': np.__version__}, indent=2), encoding='utf-8')

    best_evaluator = NetEvaluator(best_model, device)
    candidate_evaluator = NetEvaluator(model, device)

    for iteration in range(start_iteration, config.total_iterations):
        t0 = time.time()
        batches_before = best_evaluator.batches
        positions_before = best_evaluator.positions

        examples = generate_self_play_examples(best_evaluator, config, rng)
        buffer.add_examples(examples)
        t_selfplay = time.time() - t0
        inference_batches = best_evaluator.batches - batches_before
        inference_positions = best_evaluator.positions - positions_before

        # The decay for this iteration must be in effect before it trains
        # (applying it afterwards delayed every milestone by one iteration).
        _apply_lr_schedule(optimizer, config, iteration)
        losses = train_steps(model, optimizer, buffer, config, device)
        t_train = time.time() - t0 - t_selfplay

        win_rate = play_match(candidate_evaluator, best_evaluator, config, rng)
        promoted = win_rate >= config.arena_win_rate_threshold
        if promoted:
            best_model.load_state_dict(model.state_dict())

        _atomic_save(best_model.state_dict(), best_path)
        # One atomic snapshot is authoritative; separate best/buffer files remain
        # convenient exports. A crash between exports cannot mix iterations.
        _atomic_save(
            {
                "iteration": iteration,
                "model_state": model.state_dict(),
                "best_model_state": best_model.state_dict(),
                "buffer_state": {key: torch.from_numpy(value) for key, value in buffer.state_dict().items()},
                "optimizer_state": optimizer.state_dict(),
                "config": asdict(config),
                "numpy_rng": rng.bit_generator.state,
                "torch_rng": torch.get_rng_state(),
                "cuda_rng": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None,
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
            "inference_batches": inference_batches,
            "inference_positions": inference_positions,
            "mean_inference_batch": round(inference_positions / max(1, inference_batches), 2),
            "selfplay_positions_per_second": round(len(examples) / max(t_selfplay, 1e-6), 2),
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
