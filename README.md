<div align="center">

# GomokuAI

### Play, Think, Compare.

**오목 AI와 직접 대국하고, 탐색 알고리즘의 의사결정을 관찰하며 성능을 비교하는 웹 기반 AI 연구실**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now-64748b?style=for-the-badge&logo=githubpages&logoColor=white)](https://oyueo-mm.github.io/GomokuAI/)
[![CI](https://github.com/oyueo-mm/GomokuAI/actions/workflows/ci.yml/badge.svg)](https://github.com/oyueo-mm/GomokuAI/actions/workflows/ci.yml)
[![Pages](https://github.com/oyueo-mm/GomokuAI/actions/workflows/pages.yml/badge.svg)](https://github.com/oyueo-mm/GomokuAI/actions/workflows/pages.yml)

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=222)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-Training-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)

[**웹에서 플레이하기 ↗**](https://oyueo-mm.github.io/GomokuAI/) · [**소스 코드**](https://github.com/oyueo-mm/GomokuAI) · [**학습 가이드**](docs/TRAINING.md) · [**검증 기록**](docs/VALIDATION.md)

</div>

---

## 소개

**GomokuAI**는 오목(*Gomoku / Five-in-a-Row*)을 통해 고전적인 게임 트리 탐색부터 신경망 기반 강화학습까지 다양한 AI 알고리즘을 탐구하는 프로젝트입니다.

단순히 AI를 이기는 게임이 아니라 **AI가 어떤 후보 수를 검토하고, 얼마나 탐색했으며, 어떤 근거로 착수했는지** 실제 계산 결과를 살펴볼 수 있도록 만들었습니다.

- **Play** — 사람 vs AI, AI vs AI, 사람 vs 사람 대국
- **Arena** — 알고리즘 간 자동 대국, 선후공 교대, 통계와 결과 내보내기
- **Analyze** — 후보 착수, 평가 점수, 탐색 횟수 및 사고 시간 분석
- **Training** — Python/PyTorch 기반 AlphaZero 셀프플레이 학습 및 결과 시각화

> **현재 상태:** 웹에서는 **Random, Heuristic, Minimax, Alpha-Beta, MCTS**를 별도 서버 없이 바로 사용할 수 있습니다. **AlphaZero**는 정책·가치 네트워크와 PUCT 기반 추론 경로가 구현되어 있지만, 공개 사이트에 학습 모델은 포함되어 있지 않습니다. 검증된 모델 파일을 직접 연결해야 사용할 수 있으며, 충분한 GPU 학습과 실전 기력 검증은 아직 진행 전입니다.

## 주요 기능

| 모드 | 할 수 있는 일 |
| --- | --- |
| **Play · 대국실** | 9×9 / 13×13 / 15×15 오목판에서 AI를 선택하고 직접 대국합니다. 색상, 선후공, 난이도와 탐색 시드를 설정할 수 있습니다. |
| **Arena · AI 대결** | 두 알고리즘을 선후공 교대로 대국시키고, 승패·무승부·사고 시간·탐색량을 비교합니다. |
| **Analyze · 착수 분석** | AI의 후보 수와 평가·방문 통계를 확인합니다. 후보 히트맵은 **기본 꺼짐**이며 필요할 때 켤 수 있습니다. |
| **Training · 학습 분석** | ONNX 모델과 메타데이터를 로드하고, 실제 학습 CSV의 Policy/Value 손실과 승급 평가 지표를 확인합니다. |

### 오목 대국

- **자유형 오목**: 5목 **이상**을 연속으로 연결하면 승리합니다. **렌주룰의 33·44·장목 금수는 지원하지 않습니다.**
- **대국 설정**: 사람 vs AI / AI vs AI / 사람 vs 사람, 흑·백 및 선공·후공 선택
- **조작 및 기보**: 마지막 착수·수순·승리선 표시, 무르기, 재시작, 일시정지, JSON 기보 저장·불러오기
- **반응형 UI**: PC·모바일 터치 지원, 360px 화면의 15×15 착수 테스트 포함
- **플랫 디자인**: 흰색·검정·회색 중심의 2D UI, 단색 오목판과 바둑돌

AI의 탐색은 **Web Worker**에서 실행하므로 별도의 Python 백엔드가 필요하지 않습니다. 게임을 재시작하거나 무르기할 때 오래된 AI 응답이 뒤늦게 적용되지 않도록 처리합니다.

## AI는 왜 그 자리에 뒀을까?

각 알고리즘은 선택한 행동과 실제 탐색 정보를 `Decision` 형태로 반환합니다. 웹의 **착수 분석** 패널에서 해당 알고리즘이 제공하는 정보를 확인할 수 있습니다.

| 알고리즘 | 확인할 수 있는 판단 정보 |
| --- | --- |
| **Random** | 선택된 합법 수와 실행 예산 |
| **Heuristic** | 공격·방어 패턴에 따른 후보 수와 평가 점수 |
| **Minimax** | 탐색 깊이, 후보별 평가값, 탐색 노드와 사고 시간 |
| **Alpha-Beta** | Minimax 평가값, 탐색 깊이, 가지치기 횟수와 노드 수 |
| **MCTS** | 시뮬레이션 수, 후보별 방문 횟수, 방문 비율과 평가값 |
| **AlphaZero** | 연결한 모델의 정책·가치 추론을 이용한 MCTS 방문 분포와 모델 정보 |

후보 히트맵은 설정을 켰을 때만 오목판 위에 나타납니다. **휴리스틱 점수는 승률이 아니며**, 서로 정의가 다른 탐색 노드 수를 그대로 기력 비교 지표로 해석하지 않습니다. 전체 탐색 트리의 실시간 애니메이션이나 신경망 내부 추론의 완전한 설명을 제공한다고 주장하지 않습니다.

## AI 알고리즘

| AI | 핵심 아이디어 | 특징 |
| --- | --- | --- |
| **Random** | 합법 수 중 무작위 착수 | 기준선(Baseline) |
| **Heuristic** | 연속 돌·열린 끝·공격 및 수비 위협 점수화 | 전술적 규칙 기반 |
| **Minimax** | 상대의 최선 대응까지 탐색 | 깊이·후보 폭 제한 |
| **Alpha-Beta** | Minimax의 불필요한 분기 가지치기 | 수순 정렬·평가 캐시 |
| **MCTS** | 몬테카를로 트리 탐색과 짧은 롤아웃 | 휴리스틱 사전확률을 사용하는 **Guided MCTS** 계열 |
| **AlphaZero** | Policy/Value Network와 PUCT 기반 Neural MCTS | 별도 ONNX 모델 필요 |

Minimax와 Alpha-Beta는 서로 다른 학습 모델이 아니라 **같은 적대적 탐색 계열을 서로 다른 방식으로 실행하는 알고리즘**입니다. 웹에서 각각 선택해 비교할 수 있습니다.

### 탐색 예산

| 난이도 | 최대 깊이 / 후보 폭 | 최대 MCTS 시뮬레이션 | 수당 시간 예산 |
| --- | --- | --- | --- |
| 가볍게 | 1 / 8 | 32 | 150ms |
| **표준** | **2 / 10** | **128** | **600ms** |
| 깊게 | 3 / 12 | 512 | 1,800ms |

> 각 수치는 알고리즘에 따라 적용되는 항목이 다릅니다. 시간 예산과 실제 계산 시간은 기기의 성능 및 게임 상황에 영향을 받습니다.

## Arena · 알고리즘 비교

Arena는 같은 2수 시작 국면에서 **흑·백을 바꾸어 두 판씩** 대국합니다. 시드·시작 수순·보드 크기·예산을 결과에 남기고, JSON/CSV로 내보낼 수 있습니다.

- 알고리즘 A / B 및 보드 크기·탐색 예산 선택
- 선후공 교대 대국과 중단 제어
- 승·패·무 및 색상별 득점률
- 수당 평균 사고 시간과 탐색 노드 수
- 재현에 필요한 시드와 시작 국면 기록

### 실제 소규모 실험 결과

13×13, 표준 예산(깊이 2 / 후보 폭 10 / MCTS 최대 128회), **6쌍 = 12대국**의 로컬 실험 결과입니다. A는 개선한 알고리즘, B는 비교 대상입니다.

| 대결 (A : B) | A 승–패–무 | 평균 사고 시간 A / B |
| --- | --- | --- |
| Alpha-Beta : 이전 Alpha-Beta | **10–2–0** | 8.6 / 38.3 ms |
| Minimax : 이전 Minimax | **10–2–0** | 17.8 / 37.5 ms |
| MCTS : 이전 MCTS | **9–3–0** | 169 / 615 ms |
| Alpha-Beta : Heuristic | **3–2–7** | 10.2 / 0.4 ms |
| MCTS : Heuristic | **7–0–5** | 182 / 0.4 ms |
| MCTS : Alpha-Beta | **6–3–3** | 177 / 8.5 ms |

**주의:** 모두 작은 표본의 탐색 실험이며, 일반적인 승률이나 알고리즘의 확정적인 기력 순위를 의미하지 않습니다. 또한 MCTS의 휴리스틱 사전확률과 Alpha-Beta의 평가 함수 등 구현 조건이 다르므로 이를 통제하지 않은 결과를 알고리즘 자체의 우열로 해석해서는 안 됩니다.

측정 방법·재현 명령어·추가 결과는 [`docs/VALIDATION.md`](docs/VALIDATION.md)에 정리되어 있습니다.

## AlphaZero 학습 인프라

웹 탐색 AI와 별도로 기존 Python/PyTorch 기반 학습 파이프라인을 유지하고 있습니다.

- 차례를 둘 플레이어 관점의 보드 인코딩과 Policy/Value Network
- PUCT 기반 Neural MCTS, 합법 수 마스킹 및 배치 추론
- 셀프플레이, 대칭성(D4) 증강, Replay Buffer
- 후보 모델과 최고 모델의 Arena 승급 평가
- 옵티마이저·난수 상태를 포함한 체크포인트 저장 및 재개
- PyTorch → ONNX 변환과 ONNX Runtime Web 추론
- VS Code에서 Google Colab GPU 런타임을 연결하는 학습 환경 준비

**CPU 스모크 테스트**에서 학습·재개·모델 내보내기·브라우저 추론 경로를 검증했습니다. 다만 초기 스모크 후보 모델은 전술 AI와 4판에서 **0승 4패**였으며, 이는 충분히 학습된 AlphaZero의 기력이 아닙니다.

현재 공개 페이지에는 학습된 모델이 기본으로 포함되어 있지 않습니다. 학습·내보내기 후 `.onnx` 모델과 `.json` 메타데이터 파일을 직접 연결하면 브라우저에서 추론할 수 있습니다.

> **진행 상태:** AlphaZero 학습 파이프라인과 CPU 검증 완료 · 장시간 GPU 셀프플레이 및 충분한 기력 검증은 미완료

자세한 방법은 [학습 가이드](docs/TRAINING.md)를 참고하세요.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| **Frontend** | React 19, TypeScript 5, Vite 7 |
| **게임 엔진·고전 AI** | TypeScript, Web Worker, Heuristic, Minimax, Alpha-Beta, MCTS |
| **Training** | Python, PyTorch, Gymnasium, NumPy |
| **Neural Inference** | ONNX Runtime Web (WASM) |
| **학습 환경** | VS Code + Google Colab (GPU 학습 준비) |
| **테스트·CI** | pytest, Vitest, Playwright, GitHub Actions |
| **배포** | GitHub Pages (정적 사이트) |

## 로컬에서 실행하기

**Node.js 24** 환경을 권장합니다.

```bash
# 저장소 클론
git clone https://github.com/oyueo-mm/GomokuAI.git
cd GomokuAI

# 프런트엔드 실행
npm ci
npm run dev
```

개발 서버: `http://127.0.0.1:5173/`

```bash
# 테스트와 빌드
npm test
npm run build
npm run test:e2e
npm run test:pages
npm run preview
```

Python 테스트와 스모크 학습은 별도로 실행합니다.

```bash
python -m pip install -r requirements-export.txt
python -m pytest tests -q
python -m scripts.train_smoke_web
```

웹게임 실행에 Python 설치나 별도 서버가 필요한 것은 아닙니다. AlphaZero 학습·검증에만 Python 환경을 사용합니다.

## 검증 및 재현성

Python 기준 엔진과 TypeScript 웹 엔진은 **28대국, 2,212개 수순별 상태**에서 보드·차례·종국·승자가 일치했습니다.

주요 검증 항목:

- 즉시 승리·필수 방어·열린 4목·이중 위협
- 탐색 알고리즘의 예산·결정성·위협 평가
- AI Worker 오류 복구 및 오래된 응답 취소
- AlphaZero 가치 부호·마스킹·타깃·체크포인트 재개
- PyTorch ↔ ONNX Runtime ↔ 브라우저 추론 수치 검증
- 모바일 터치·반응형 UI 및 GitHub Pages 하위 경로

`master`에 대한 GitHub Actions 검증은 Python 테스트와 스모크 모델, Vitest·Playwright 및 프로덕션 빌드를 실행합니다.

**테스트 통과와 AI의 실제 기력 향상은 다른 문제**입니다. 벤치마크 결과에는 표본 수, 시간·시뮬레이션 예산, 실행 환경을 함께 기록합니다.

- [검증 결과 및 벤치마크](docs/VALIDATION.md)
- [시스템 아키텍처](docs/ARCHITECTURE.md)
- [학습 가이드](docs/TRAINING.md)

## 프로젝트 구조

```text
src/                React 웹게임 · TypeScript 오목 엔진 · AI · Worker
  engine.ts         오목 규칙 및 상태
  ai.ts             Random · Heuristic · Minimax · Alpha-Beta · MCTS
  client.ts         Worker 통신 및 취소·복구
  neural.ts         ONNX 메타데이터·추론
  main.tsx          Play · Arena · Training UI
  style.css         흰색 기반 플랫 디자인

gomoku_env/         Python 기준 엔진 · Gymnasium 환경
alphazero/          신경망 · Neural MCTS · 셀프플레이 · 학습·평가
scripts/            벤치마크 · 교차 언어 검증 · 모델 내보내기
notebooks/          Colab 학습 노트북
tests/              Python 단위 테스트
e2e/                Playwright 브라우저 테스트
demo_results/       실험 결과 기록
docs/               아키텍처 · 학습 · 검증 문서
.github/workflows/   CI 및 GitHub Pages 자동 배포
```

## 앞으로의 계획

- [x] Python 게임 엔진 및 기존 AlphaZero 코드 복구
- [x] 웹 오목 게임과 AI 5종 공개 플레이
- [x] 후보 착수·탐색 정보·히트맵 시각화
- [x] AI Arena 및 실험 결과 JSON/CSV 내보내기
- [x] AlphaZero CPU 스모크 학습 및 ONNX 브라우저 추론 검증
- [x] GitHub Pages 배포와 자동 테스트
- [ ] AlphaZero Colab GPU 학습 및 본격적인 Self-Play
- [ ] 충분한 표본과 다양한 상대를 통한 기력 검증
- [ ] 저사양 모바일 실기기·Safari·Firefox 검증
- [ ] 연구 시각화와 접근성 추가 개선

---

<div align="center">

**Play against AI. Understand its moves. Compare its strategies.**

[웹에서 GomokuAI 실행하기](https://oyueo-mm.github.io/GomokuAI/)

</div>
