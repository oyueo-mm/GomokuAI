# 검증 기록 · 2026-10-22

## 복구

최초 폴더에는 `.git`, `alphazero/`, 원본 테스트·노트북이 없었고 복구용 웹 파일만 있었다. 최초 로컬 테스트 25개 통과 후 GitHub `master` (`20e5e1c`)의 이력·누락 파일을 복구했다. 기존 로컬 파일을 덮어쓰지 않았으며 원본 복제본은 `.upstream-recovery/`에 남겨 Git에서 제외했다. 기존 체크포인트·학습 데이터는 발견되지 않았다.

수정한 핵심 오류:

- 배치 MCTS가 같은 리프를 다시 확장하면서 자식 통계를 초기화할 수 있어 중복 확장을 막았다.
- 재개에 RNG·설정이 없어 재현되지 않던 문제를 수정했다. 새 원자적 스냅샷은 모델·최고 모델·옵티마이저·버퍼·RNG를 함께 보존한다. 보조 내보내기 손상 후 재개도 검사했다.
- 웹 전술 점수의 같은 방향 중첩 패턴을 이중 위협으로 세던 오류를 수정했다.
- 탐색 예산·보드 입력·확률 설정, 기보·모델 해시·모델 보드 크기 검사를 추가했다. 기존 복구 파일의 잘못된 착수·Gymnasium 종국 방지 수정도 보존했다.

## 자동 검사

| 검사 | 로컬 결과 |
|---|---|
| pytest | 67 통과. 기존 matplotlib 미렌더 애니메이션 경고 1개 |
| Vitest | 43 통과 |
| Python ↔ TS | 28대국, 2,212개 수순별 보드·차례·종국·승자 일치 |
| Playwright | 7 통과: 게임·취소·실제 터치·Arena·그래프·모델·6종 완전 대국 |
| Pages 하위 경로 | 1 통과: 실제 production JS/Worker/WASM, 외부 요청 없음 |
| TypeScript / Vite build | 통과, `dist/` 생성 |
| PyTorch ↔ ONNX Runtime | 배치 1/3, 최대 절대 오차 약 6.71e-8 |
| PyTorch ↔ 브라우저 WASM | 합법 수 정책·가치 오차 1e-5 이내 |
| 학습 재개 | CPU 2회 연속 실행과 1회 후 재개 가중치 비트 단위 일치 |

즉시 승리·필수 방어는 Heuristic/Minimax/Alpha-Beta/MCTS에서 검사했다. 열린 4목·이중 위협은 전술 평가 함수를 검사했다. Minimax와 Alpha-Beta의 완료 깊이 2/3 결과 일치 및 깊이 3 가지치기를 검사했다. Random과 학습 초기 AlphaZero에 전술 보장이나 강한 기력을 주장하지 않는다.

## 실제 측정

환경: Windows, Node 24.19, Python 3.12.10, torch 2.14.1+cpu, 로컬 Edge headless. 브라우저 하드웨어는 에뮬레이션하지 않았고 모바일은 터치·뷰포트를 에뮬레이션했다. 저사양 실기기·Safari·Firefox는 미검증이다.

`demo_results/verified_browser_arena.json`:

- 9×9, seed 42, 깊이 1 / 후보 8 / 최대 32 시뮬레이션 / 150ms, 알고리즘당 Random 상대 2대국, 선후공 교대.
- Random은 1승 1패, 나머지 다섯 알고리즘은 각 2승. AlphaZero는 1회 학습한 **스모크 후보**를 실제 ONNX로 추론했다. 이 작은 표본은 기력 순위를 입증하지 않는다.
- 마지막 측정의 대국별 평균 사고 시간: Heuristic 약 0.4–0.5ms, Minimax 약 2.3–2.6ms, Alpha-Beta 약 1.7–1.8ms, MCTS 약 87–97ms, AlphaZero 약 2.9–3.7ms. Random은 타이머 해상도에 가까운 값이다. 모델·예산·장치가 다르면 달라진다.
- 마지막 메인 스레드 10ms 타이머의 최대 관측 간격은 약 50ms. 앞선 별도 실행은 약 11.5ms였다. 이 값은 UI 프레임률 보장이 아닌 해당 실행의 응답성 측정이다.
- 노드 정의는 서로 다르다. Minimax는 평가 재귀 노드, MCTS는 선택/롤아웃 처리, AlphaZero는 신경망 기반 시뮬레이션이다. 노드 수만으로 탐색 품질을 비교하면 안 된다.

`demo_results/verified_final_smoke_vs_tactical.csv`:

- 9×9, seed 42, MCTS 8회/수, 선후공 교대 4대국.
- 2회 스모크 학습 후보가 Python Tactical에 **0승 4패**. 학습 손실 감소와 모델 기력 향상은 같은 주장이 아니다.
- 체크포인트 SHA-256과 학습 횟수를 CSV에 기록했다. `verified_smoke_vs_tactical.csv`는 그 이전 1회 학습 후보 결과다. 원래 제공된 CSV는 이번 검증 결과로 간주하지 않는다.

`demo_results/verified_inference_cpu.json`:

- 9×9 / 16채널 / 1블록, 임의 초기 가중치로 추론 처리량만 측정했다. 게임용 학습 모델로 사용하지 않았다.
- CPU 1스레드, 워밍업 3회 후 20회. 배치 1/8/32의 평균 배치 지연은 약 0.279/0.431/0.916ms. 해당 장치에서 배치 처리 경로가 작동함을 확인한 결과다.

## 재현

```sh
python -m pip install -r requirements-export.txt
python -m pytest tests -q
python -m scripts.generate_parity
python -m scripts.train_smoke_web
python -m scripts.export_model --checkpoint checkpoints/web-smoke/latest.pt --output checkpoints/web-smoke/gomoku9-smoke.onnx
npm ci
npm test
npm run build
npm run test:e2e
npm run test:pages
```

스모크 디렉터리와 내보내기 파일이 이미 있으면 새 경로를 사용한다. 전체 모델 E2E는 기본 `checkpoints/web-smoke/gomoku9-smoke` 파일을 사용하며, 미생성 상태는 명시적으로 skip한다. 로컬 생성 체크포인트·모델은 Git에서 제외하고 보존했다.

브라우저 재측정은 `test-results/benchmark.json`에 쓰므로 버전 관리한 측정 스냅샷을 덮어쓰지 않는다. 실제 손실 로그와 실행 설정 사본은 `demo_results/verified_training_log.csv`, `verified_training_run.json`에 보존했다.

남은 검증은 Colab GPU 실행·성능, 충분한 학습 후 다중 시드·다양한 상대 평가, 저사양 모바일 실기기다. GitHub Pages 배포와 CI 현황은 README의 GitHub Pages 절을 따른다.

## 후속 개선 · 2026-10-22 (revival/web-ai-lab)

### 수정한 오류

- AlphaZero 학습률 감쇠가 학습 **후**에 적용되어 모든 마일스톤이 한 iteration씩 늦게 작동했다. 해당 iteration 학습 전에 적용하도록 수정하고 회귀 테스트를 추가했다.
- `scripts/export_model.py`와 `scripts/evaluate_checkpoint.py`가 `latest.pt`에서 승급 게이트를 통과하지 않은 **후보** 가중치(`model_state`)를 내보내고 평가했다. 자기대국과 승급 기준은 `best_model_state`이므로 기본값을 게이트 통과 최고 모델로 바꾸고 `--weights candidate`로 후보를 명시 선택하게 했다. 메타데이터·CSV에 사용한 가중치 출처(`weights`)를 기록한다. 이미 내보낸 모델 파일은 건드리지 않았다.
- Minimax/Alpha-Beta의 리프 평가가 "가장 높은 단일 위협 − 상대 위협"이라 상대의 막을 수 있는 4목도 치명적으로 계산했고, 겹치는 위협은 무시했다. 상위 3개 위협의 가중 합과 막을 수 없는 이중 승리 위협 판정으로 교체했다. 13×13 표준 예산에서 이전 Alpha-Beta는 Heuristic에 0승 5패 1무였다.
- AI 워커가 비정상 종료하면 이후 요청이 응답 없이 멈췄다. 다음 요청에서 워커와 모델을 다시 만든다.

### 효율 개선

- 위협 점수 계산(`threat`)은 원래 구현과 무작위 국면 120개에서 점수·후보 순서가 동일함을 테스트로 고정한 채 약 2배 빨라졌다.
- Alpha-Beta 루트에 알파 창을 적용했다. 루트의 비최선 수는 경계값을 반환하므로 선택은 처음 엄격히 개선한 수로 고정한다.
- MCTS: 휴리스틱 순위를 선택 사전확률(PUCT)로 쓰고, 방문 전 자식은 보드를 복제하지 않으며(AlphaZero 확장 때 최대 size² 복제 제거), 롤아웃은 6수로 줄였다. 후보 히트맵 조회는 셀마다 선형 탐색하던 것을 한 번의 Map으로 바꿨다.

### 실제 대국 (`scripts/ts/arena.ts`)

13×13, 표준 예산(깊이 2 / 후보 10 / 128 시뮬레이션), 시간 제한 없이 결정적 예산만 사용. 쌍마다 무작위 2수 시작 국면을 흑백 교대로 두 번 두었다(6쌍 = 12대국). A = 개선본(`cur`), B = 개선 전 코드(`old`, `scripts/ts/baseline_ai.ts`).

| A : B | A 승 | A 패 | 무 | 수당 시간 A / B |
|---|---|---|---|---|
| Alpha-Beta : 이전 Alpha-Beta | 10 | 2 | 0 | 8.6 / 38.3 ms |
| Minimax : 이전 Minimax | 10 | 2 | 0 | 17.8 / 37.5 ms |
| MCTS : 이전 MCTS | 9 | 3 | 0 | 169 / 615 ms |
| Alpha-Beta : Heuristic | 3 | 2 | 7 | 10.2 / 0.4 ms |
| MCTS : Heuristic | 7 | 0 | 5 | 182 / 0.4 ms |
| MCTS : Alpha-Beta | 6 | 3 | 3 | 177 / 8.5 ms |

12대국 표본이므로 개선 전 대비 향상은 뚜렷하나 세부 순위는 입증하지 않는다. Alpha-Beta는 Heuristic과 대등한 수준(3승 2패 7무)이며 압도하지 못한다. 재현: `npx vite-node scripts/ts/arena.ts -- 13 normal 6 cur/mcts:old/heuristic`.

### 검사 결과

pytest 69, Vitest 49(위협 점수 동일성·워커 복구·전술·결정성·시뮬레이션 예산 추가), Playwright 8(360px 폰의 15×15 탭 테스트 추가) 통과. GPU 학습은 실행하지 않았다. 파이프라인·체크포인트·기존 학습 결과는 변경하지 않았다. 저사양 실기기·Safari·Firefox는 여전히 미검증이다.

### 디자인·히트맵 (master 병합 전)

배경 `#FFFFFF`, 흑·백·회색만 쓰는 평면 디자인으로 교체했다(녹색 테마·그라데이션·그림자 제거). 오목판은 연회색 단색 + 1px 격자(바깥 줄은 끝 돌의 중심에서 종료), 흑돌은 검정 단색, 백돌은 흰색 + 검정 테두리다. 후보 히트맵은 기본 꺼짐이며 켰을 때만 회색 링과 `#순위` 라벨(착수 번호와 혼동되지 않게 구분)을 표시한다. Playwright가 흰 배경, 그림자·그라데이션 없음, 유채색 없음, 히트맵 기본 꺼짐·토글, 360px 폭 탭별 가로 넘침 없음과 터치 크기를 검사한다.
