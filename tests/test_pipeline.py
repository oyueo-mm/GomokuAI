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
