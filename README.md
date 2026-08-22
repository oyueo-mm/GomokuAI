# GomokuAI

*[한국어](#한국어) | [English](#english)*

<a id="한국어"></a>
## 한국어

오목(오목, five-in-a-row) 게임 엔진과 Gymnasium 환경, 그리고 PyTorch로 구현한
AlphaZero 방식의 셀프플레이 학습 파이프라인입니다.

### 구성

- `gomoku_env/` — 게임 로직(`game.py`), Gymnasium 호환 환경(`env.py`),
  신경망 입력용 보드 인코딩(`encoding.py`), 보드 렌더러(`visualize.py`).
- `alphazero/` — 학습 파이프라인: MCTS(`mcts.py`), 정책/가치 네트워크
  (`model.py`), 셀프플레이 데이터 생성(`self_play.py`), 리플레이 버퍼
  (`replay_buffer.py`), 학습 루프(`train.py`), 후보-최고 모델 평가
  (`arena.py`), 전체를 총괄하는 파이프라인(`pipeline.py`).
- `scripts/play_random.py` — 랜덤 정책끼리 한 판을 플레이해 환경을 빠르게
  점검하는 스모크 테스트.
- `notebooks/colab_train.ipynb` — Colab에서 학습 루프를 실행하는 노트북.
- `tests/` — 게임, 환경, MCTS, 모델, 셀프플레이, 리플레이 버퍼, 아레나,
  파이프라인을 다루는 pytest 테스트 스위트.

### 설치

```bash
pip install -r requirements.txt
pip install -e .
```

Python 3.9 이상이 필요합니다.

### 사용법

랜덤 정책 대결로 환경이 정상 동작하는지 확인:

```bash
python scripts/play_random.py --board-size 9
```

테스트 실행:

```bash
pytest
```

AlphaZero 셀프플레이 학습 실행 (보드 크기, MCTS 시뮬레이션 수, 네트워크
크기, 아레나 승급 기준 등 모든 하이퍼파라미터는 `alphazero/config.py` 참고):

```python
from alphazero.config import AlphaZeroConfig
from alphazero.pipeline import run_training_loop

run_training_loop(AlphaZeroConfig())
```

매 반복(iteration)마다 학습 체크포인트(`latest.pt`, `best.pt`, `buffer.npz`,
`log.csv`)가 `checkpoint_dir`에 저장되므로, 학습이 중단되어도 이어서 재개할
수 있습니다 (Colab 환경에서 이어서 실행하는 예시는
`notebooks/colab_train.ipynb` 참고).

### 동작 방식

- 환경의 관측(observation)은 항상 "다음에 둘 플레이어" 시점으로 주어집니다
  (자신의 돌 / 상대의 돌 / 선공 여부를 나타내는 평면), 그래서 하나의
  네트워크가 셀프플레이에서 양쪽을 모두 플레이할 수 있습니다.
- 셀프플레이의 매 수는 현재 최고 성능 네트워크가 안내하는 MCTS로
  결정되며, GPU 효율을 위해 리프 노드 평가를 배치로 묶어 처리합니다.
- 매 반복이 끝나면 학습된 후보 모델이 현재 최고 모델과 아레나 매치를
  치르고, `arena_win_rate_threshold` 이상의 승률을 거둬야만 "최고 모델"로
  승급됩니다.

---

<a id="english"></a>
## English

Gomoku (five-in-a-row) game engine, a Gymnasium environment, and an
AlphaZero-style self-play training pipeline built on PyTorch.

### Layout

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

### Setup

```bash
pip install -r requirements.txt
pip install -e .
```

Requires Python >= 3.9.

### Usage

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

### How it works

- The environment observation is always from the perspective of the player
  about to move (own stones / opponent stones / a "who moved first" plane),
  so a single network plays both sides during self-play.
- Each self-play move runs MCTS guided by the current best network,
  batching leaf evaluations for GPU efficiency.
- After each iteration, a training checkpoint plays an arena match against
  the current best network; it's only promoted to "best" if it wins at or
  above `arena_win_rate_threshold`.
