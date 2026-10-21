# GomokuAI Revival v0.2 — 웹 오목 게임 + AI 연구 실험실

**상태:** 2026-10-22 기준 실행 가능한 로컬 웹 오목판, AI 3종, 탐색 분석, 전술 AI 대전 평가 구현. **기존 AlphaZero의 학습 결과나 기력은 아직 검증되지 않았습니다.** GitHub `master`에 자동 반영되지 않았습니다.

## 1. 빠른 실행 (독립 실행 가능)

압축파일을 원하는 폴더에 풀고, 터미널에서 압축을 푼 폴더로 이동합니다.

```bash
python -m pip install -r requirements-play.txt
python -m scripts.web_server
```

브라우저에서 **http://127.0.0.1:8765** 를 엽니다.

- 9×9, 13×13, 15×15 자유형 오목(금수 규칙 없음)
- `Random`: 무작위 합법 착수 기준 에이전트
- `Tactical`: 즉시 승리, 즉시 패배 차단, 단순 위협 평가
- `Alpha-Beta`: depth 1~3의 폭 제한 Negamax / Alpha-Beta (신경망 아님)
- 흑·백 선택, 새 대국, 착수 기록, 최근 AI 처리 시간·탐색 노드 수
- 휴리스틱 착수 후보 점수와 상위 후보 오버레이 (확률 아님)

Python 서버를 실행해야 동작하는 웹 UI입니다. HTML 파일을 직접 더블클릭하거나 GitHub Pages에 정적 파일만 올리면 API가 없어 게임이 실행되지 않습니다. 개발 서버는 기본적으로 `127.0.0.1`에만 바인딩됩니다.

## 2. 기존 GitHub 저장소에 적용하기

기존 저장소는 [oyueo-mm/GomokuAI](https://github.com/oyueo-mm/GomokuAI)이며 `master`의 기준 커밋은 `20e5e1c`입니다.

1. 먼저 로컬 저장소를 새 브랜치로 분기합니다: `git switch -c revival/web-lab-v02`
2. 압축파일의 **내용물**을 기존 저장소 루트에 복사합니다(루트 폴더 자체가 아니라 내부 파일 전체).
3. 기존 `alphazero/` 및 `notebooks/`는 수정하거나 삭제하지 마세요. 이 압축파일에는 해당 폴더가 없으며, 원본 저장소에서 유지해야 합니다.
4. `python -m pip install -r requirements-play.txt` 후 `python -m scripts.web_server`로 시작합니다.
5. 검증 후 `git add ...`, `git commit ...`으로 저장합니다.

이 압축파일에는 v0.1에서 수정했던 `gomoku_env/game.py`, `gomoku_env/env.py` 및 `gomoku_env/agents.py`도 포함되어 있어 v0.1 ZIP을 별도로 먼저 적용하지 않아도 됩니다. `GomokuAI_revival.patch`는 이전 단계 참조용입니다. **파일을 복사하면 game.py/env.py가 덮어써지므로 반드시 별도 브랜치에서 확인하세요.**

## 3. CLI에서 알고리즘 비교

```bash
python -m scripts.arena_baselines --a tactical --b random --games 20 --size 9 --seed 42
python -m scripts.arena_baselines --a alphabeta --b tactical --games 10 --size 9 --depth 2 --output results/ab_vs_tactical.csv
```

- 짝수 판수로 A의 선공/후공을 번갈아 배정합니다.
- 승/패/무승부, 착수 수, 알고리즘별 총 탐색 시간·탐색 노드 수를 CSV로 기록합니다.
- 무승부는 0.5점으로 처리해 점수율(`a_score_rate`)을 계산합니다.
- 대국 수가 적으면 승률 변동이 큽니다. 학습 성과를 입증하려면 다중 시드, 충분한 대국 수, 같은 하드웨어, paired openings 같은 더 엄격한 평가가 필요합니다.

## 4. 기존 AlphaZero 코드와 연동하기 (전체 GitHub 저장소에서만)

기존 repo의 `alphazero/`와 `requirements.txt` 의존성 설치가 필요합니다.

```bash
python -m pip install -r requirements.txt
python -m scripts.alphazero_smoke
```

이 테스트는 기존 AlphaZero 학습 루프를 **작은 5×5, 4목 게임으로 1회 실행**하고 체크포인트 4종이 생성되었는지 확인합니다. 생성 성공만으로 실력이 좋거나 구현이 이론적으로 정확함을 증명하지 않습니다. **이 스크립트는 현재 제공한 경량 패키지만으로는 동작하지 않으며, 원본 `alphazero/`가 존재하는 환경에서 실행하도록 작성됐습니다. 아직 실환경 통과 여부를 검증하지 않았습니다.**

유효한 학습 체크포인트가 생성되면 다음과 같이 전술형 AI와 교차 대국을 시킬 수 있습니다.

```bash
python -m scripts.evaluate_checkpoint --checkpoint checkpoints/best.pt --size 9 --channels 64 --blocks 6 --sims 64 --games 10 --opponent tactical
```

`--size`, `--channels`, `--blocks`는 모델을 학습할 때의 실제 설정과 일치해야 합니다. `best.pt`는 기존 코드상 단순 가중치 파일이므로 설정을 함께 저장하지 않습니다. 본인이 학습한 신뢰할 수 있는 체크포인트만 사용하세요. **이 평가 스크립트 또한 원본 AlphaZero 및 실제 학습 체크포인트가 없어 실행 검증하지 못했습니다.**

## 5. 테스트

```bash
python -m pytest -q tests/test_lab_v02.py tests/test_web_api_v02.py tests/test_agents.py tests/test_invalid_moves.py
```

이 패키지 테스트는 NumPy/pytest만으로 실행하며, Gymnasium이 없으면 기존 환경 관련 테스트 두 건을 건너뜁니다. 원본 저장소의 모든 `tests/`까지 검증하려면 전체 의존성을 설치하고 `pytest`를 별도로 실행하세요.

## 6. 구현 범위와 한계

- 서버: `scripts/web_server.py` (`http.server`, 인메모리 세션, 버전 검증)
- 게임 규칙: `gomoku_env/game.py` (NumPy, 자유형 오목)
- 전술 기준 모델: `gomoku_env/agents.py`
- Alpha-Beta: `gomoku_env/search_agents.py` (폭 제한 탐색)
- 웹: `web/index.html`, `web/style.css`, `web/app.js` (Canvas 렌더링)
- 평가: `scripts/arena_baselines.py` (색 교대 + CSV)
- AlphaZero 검증 도구: `scripts/alphazero_smoke.py`, `scripts/evaluate_checkpoint.py` (후속 검증 필요)

**의도적 범위 제한:** 서버는 로컬 실험용이며, 계정/공개 배포/데이터베이스/장기 세션 관리 기능이 없습니다. Alpha-Beta는 폭 제한으로 인해 전역 최적 착수를 보장하지 않으며, 휴리스틱 오버레이는 신경망 확률이나 실제 승률이 아닙니다. 원본 AlphaZero를 UI에 연결하는 것은 모델·MCTS 검증 후 진행해야 합니다.

## 7. 다음 개발 순서

1. 전체 원본 `pytest` 실행 및 규칙 부합성 검증, 금수 규칙을 채택할지 결정
2. MCTS sign/virtual loss/배치 중복/즉시 승리·방어 정합성 테스트 추가
3. 체크포인트에 구성·RNG 상태·학습 지표 저장 및 정확한 재개
4. AlphaZero 셀프플레이 품질, 전술 AI 상대 색 교차 대국, 학습 곡선 분석
5. 검증된 `best.pt`를 웹의 AI 선택 메뉴에 추가 (서버 추론, 정책·방문 수 시각화)
6. 정적 배포가 필요하다면 Python API를 별도 서버에 배포하거나 모델을 ONNX/WebGPU 등으로 브라우저 추론 가능하게 변환
