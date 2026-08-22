# GomokuAI

Gomoku (five-in-a-row) game engine, a Gymnasium environment, and an
AlphaZero-style self-play training pipeline built on PyTorch.

## Layout

- `gomoku_env/` — game logic (`game.py`), a Gymnasium-compatible env
  (`env.py`), board encoding for the neural net (`encoding.py`), and a
  board renderer (`visualize.py`).
- `alphazero/` — the training pipeline: MCTS (`mcts.py`), the policy/value
  network (`model.py`), self-play example generation (`self_play.py`), a
  replay buffer (`replay_buffer.py`), the training loop (`train.py`),
  candidate-vs-best evaluation (`arena.py`), and the top-level orchestrator
  (`pipeline.py`).
- `scripts/play_random.py` — smoke test: two random policies play a full
  game and print the result.
- `notebooks/colab_train.ipynb` — runs the training loop on Colab.
- `tests/` — pytest suite covering the game, env, MCTS, model, self-play,
  replay buffer, arena, and pipeline.

## Setup

```bash
pip install -r requirements.txt
pip install -e .
```

Requires Python >= 3.9.

## Usage

Play a random-vs-random game to sanity-check the environment:

```bash
python scripts/play_random.py --board-size 9
```

Run the test suite:

```bash
pytest
```

Run AlphaZero self-play training (see `alphazero/config.py` for all
hyperparameters — board size, MCTS simulations, network size, arena
promotion threshold, etc.):

```python
from alphazero.config import AlphaZeroConfig
from alphazero.pipeline import run_training_loop

run_training_loop(AlphaZeroConfig())
```

Training checkpoints (`latest.pt`, `best.pt`, `buffer.npz`, `log.csv`) are
written to `checkpoint_dir` after every iteration, so a run can resume
where it left off (see `notebooks/colab_train.ipynb` for a Colab-friendly
version of this loop).

## How it works

- The environment observation is always from the perspective of the player
  about to move (own stones / opponent stones / a "who moved first" plane),
  so a single network plays both sides during self-play.
- Each self-play move runs MCTS guided by the current best network,
  batching leaf evaluations for GPU efficiency.
- After each iteration, a training checkpoint plays an arena match against
  the current best network; it's only promoted to "best" if it wins at or
  above `arena_win_rate_threshold`.
