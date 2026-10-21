import pytest

from alphazero.config import AlphaZeroConfig
from alphazero.pipeline import run_training_loop


def make_tiny_config(checkpoint_dir):
    return AlphaZeroConfig(
        board_size=4,
        win_length=3,
        num_channels=8,
        num_res_blocks=1,
        num_simulations=8,
        sim_batch=4,
        games_per_iteration=4,
        parallel_games=4,
        buffer_size=200,
        batch_size=16,
        train_steps_per_iteration=5,
        arena_games=2,
        arena_num_simulations=4,
        total_iterations=2,
        checkpoint_dir=str(checkpoint_dir),
    )


def test_pipeline_runs_two_iterations_end_to_end(tmp_path):
    config = make_tiny_config(tmp_path / "checkpoints")
    run_training_loop(config, resume=False)

    checkpoint_dir = tmp_path / "checkpoints"
    assert (checkpoint_dir / "latest.pt").exists()
    assert (checkpoint_dir / "best.pt").exists()
    assert (checkpoint_dir / "buffer.npz").exists()
    assert (checkpoint_dir / "log.csv").exists()

    log_lines = (checkpoint_dir / "log.csv").read_text().strip().splitlines()
    assert len(log_lines) == 3  # header + 2 iterations


def test_pipeline_resumes_from_checkpoint(tmp_path):
    config = make_tiny_config(tmp_path / "checkpoints")
    config.total_iterations = 1
    run_training_loop(config, resume=False)

    config.total_iterations = 2
    run_training_loop(config, resume=True)

    checkpoint_dir = tmp_path / "checkpoints"
    log_lines = (checkpoint_dir / "log.csv").read_text().strip().splitlines()
    assert len(log_lines) == 3  # header + iteration 0 + iteration 1, not restarted from scratch


def test_lr_decay_applies_in_the_milestone_iteration(tmp_path):
    import torch
    from alphazero import pipeline

    seen = []
    original = pipeline.train_steps

    def spy(model, optimizer, *args, **kwargs):
        seen.append(optimizer.param_groups[0]["lr"])
        return original(model, optimizer, *args, **kwargs)

    config = make_tiny_config(tmp_path / "checkpoints")
    config.total_iterations = 3
    config.lr_milestones = (1, 2)
    pipeline.train_steps = spy
    try:
        run_training_loop(config, resume=False)
    finally:
        pipeline.train_steps = original
    base = config.learning_rate
    assert seen == pytest.approx([base, base * 0.1, base * 0.01])


def test_export_and_evaluation_default_to_gated_best_weights():
    import pytest
    from alphazero.checkpoint import select_weights

    snapshot = {"model_state": {"w": 1}, "best_model_state": {"w": 2}}
    assert select_weights(snapshot) == ({"w": 2}, "best_model_state")
    assert select_weights(snapshot, "candidate") == ({"w": 1}, "model_state")
    assert select_weights({"w": 3}) == ({"w": 3}, "weights")
    assert select_weights({"model_state": {"w": 1}}) == ({"w": 1}, "model_state")
    with pytest.raises(ValueError):
        select_weights(snapshot, "latest")
