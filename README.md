# GomokuAI · 오목 연구실

Python 기준 엔진·Gymnasium·PyTorch AlphaZero를 유지하고, **외부 서버 없이 실행되는 React + TypeScript + Vite 웹게임**을 연결했다. 개발은 `revival/web-ai-lab`에서 진행했고 `master`에 병합했다. 공개 사이트는 `master`에서만 배포된다.

## 웹 실행

Node 24 기준:

```sh
npm ci
npm run dev
```

표시되는 `http://127.0.0.1:5173`에 접속한다. Python 서버는 필요 없다.

화면은 왼쪽 접이식 사이드바(홈 · 대국실 · AI Arena · 학습 분석)로 이동하며, 주소 해시(`#/play`, `#/arena`, `#/training`)로 바로 열 수 있다. 홈의 오목 시연은 대국실 상태와 분리된 가벼운 자동 대국이며 AI 탐색 결과가 아니다. 탐색 예산·시드는 대국실의 `고급 설정`과 Arena 설정에 있다.

- 9×9 / 13×13 / 15×15 자유형 오목. 5개 이상 연결 승리. 렌주 금수 미지원.
- 사람 vs AI / AI vs AI / 사람 vs 사람, 색상·선후공, 난이도, 일시정지, 무르기, 재시작, 기보 JSON 저장·검증된 불러오기.
- 마지막 착수·수순·승리선, 반응형 터치 UI. AI 연산은 Web Worker에서 실행하며 취소 시 이전 응답을 폐기한다.
- Random / Heuristic / Minimax / Alpha-Beta / MCTS / **실제 ONNX 정책·가치망 + PUCT AlphaZero**.
- 모델 없는 AlphaZero는 비활성화한다. 스모크 모델은 기력 미검증 상태로 표시한다.
- 후보 점수·방문 비율(후보 히트맵은 기본 꺼짐, 직접 켤 때만 표시), 깊이·가지치기·노드·사고 시간. Arena는 선후공 교대, 색상별 득점률·평균 시간/노드, 실제 결과 JSON/CSV 내보내기를 제공한다.
- 학습 CSV를 불러와 정책/가치 손실과 승급 평가 득점률을 그린다. 가상 통계는 표시하지 않는다.

| 예산 | 깊이 / 후보 폭 | 최대 시뮬레이션 | 시간 / 수 |
|---|---|---|---|
| 가볍게 | 1 / 8 | 32 | 150ms |
| 표준 | 2 / 10 | 128 | 600ms |
| 깊게 | 3 / 12 | 512 | 1800ms |

알고리즘마다 적용 항목이 다르다. Minimax/Alpha-Beta는 반복 깊이 탐색과 리프 평가 캐시를 사용한다. MCTS는 후보 제한 UCT, 최대 12수 롤아웃 후 휴리스틱 가치를 사용한다. AlphaZero는 전체 합법 수에 모델 정책/가치를 적용하는 PUCT다. 브라우저 AlphaZero는 순차 추론이며 GPU 배치 셀프플레이는 Python 경로에서 지원한다. 실시간 탐색은 루트 후보 갱신을 표시하며 전체 탐색 트리 애니메이션은 제공하지 않는다.

## Python과 학습

```sh
python -m pip install -r requirements-export.txt
python -m pytest tests -q
python -m scripts.train_smoke_web
python -m scripts.export_model --checkpoint checkpoints/web-smoke/latest.pt --output checkpoints/web-smoke/gomoku9-smoke.onnx
```

웹 **학습 분석**에서 ONNX와 같은 이름의 JSON을 함께 선택한다. 보드 크기가 일치하면 AlphaZero를 선택할 수 있다. 기존 출력이 있으면 새 경로를 사용한다. 체크포인트는 `checkpoints/`에 보존하며 Git에서 제외한다. [VS Code + Colab GPU 준비·재개·내보내기](docs/TRAINING.md)를 참고한다. GPU 장시간 학습은 시작하지 않았다.

## 검증과 실제 결과

```sh
python -m scripts.generate_parity
npm test
npm run build
npm run test:e2e
npm run test:pages
```

Windows Playwright는 설치된 Edge를 사용한다. Linux CI는 Chromium을 설치해 사용한다. 모델 E2E를 포함하려면 위 스모크·내보내기를 먼저 실행한다. 모델이 없으면 해당 검사는 명시적으로 skip된다. Python 임시 폴더 권한 문제가 있으면 접근 가능한 별도 `--basetemp`를 지정한다.

Python 기준 **28대국 / 2,212개 수순별 상태**와 TS 엔진이 일치한다. 전술 승리·필수 방어·열린 4목·이중 위협, 학습 타깃·마스킹·D4 증강·가치 부호·Virtual Loss·체크포인트 재개를 검사한다. 측정 조건과 결과는 [검증 기록](docs/VALIDATION.md)에 있다.

브라우저 비교는 각 알고리즘당 Random 상대 선후공 2대국만 측정했다. **이 표본으로 기력 순위를 판단할 수 없다.** 2회짜리 CPU 스모크 AlphaZero 후보는 Python 전술 AI와 4대국에서 0승이었다. 고성능 모델로 홍보하지 않는다. 기존 `demo_results`와 이번 `verified_*` 결과를 구분한다.

## GitHub Pages

```sh
npm run build
npm run preview
```

산출물은 `dist/`이며 상대 자산 경로를 사용한다. `/GomokuAI/` 하위 경로에서 Worker·WASM까지 실제 브라우저로 검사했다. `.github/workflows/pages.yml`은 `master`에 push할 때(또는 수동 실행)만 배포한다. 다른 브랜치 push는 공개 사이트를 바꾸지 않는다. Settings → Pages의 소스는 GitHub Actions이며 배포 환경 `github-pages`는 `master`만 허용한다. 공개 주소: https://oyueo-mm.github.io/GomokuAI/ . `ci.yml`은 PR·`master` push·수동 실행에서 Python·Vitest·Playwright·빌드를 검증한다.

기존 Python HTTP 웹은 `python -m scripts.web_server`로 실행하며 `web/`에 보존했다. 새 정적 웹 진입점은 루트 `index.html`, `src/`다. [구조](docs/ARCHITECTURE.md)를 참고한다.
