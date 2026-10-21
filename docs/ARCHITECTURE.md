# 구조

| 경로 | 책임 |
|---|---|
| gomoku_env/game.py | Python 자유형 기준 규칙, 승패·무승부, 복제 |
| gomoku_env/env.py, encoding.py | Gymnasium 및 차례 관점 3평면 인코딩 |
| alphazero/ | 원본 정책·가치망, PUCT, 배치 셀프플레이, 학습·승급·재개 |
| src/engine.ts | 웹 규칙. 별도 Rules 객체로 자유형 구분 |
| src/ai.ts | 6종 공통 결정 인터페이스, 예산, 후보·검색 지표 |
| src/client.ts, worker.ts | Worker 통신·진행 응답·취소·모델 복원 |
| src/neural.ts | ONNX 메타데이터·해시·보드 검사, WASM 추론 |
| src/main.tsx, style.css | 게임·Arena·학습 분석, 반응형 UI |
| scripts/generate_parity.py | Python 수순별 기준 JSON 생성 |
| scripts/export_model.py | 모델 내보내기, PyTorch/ORT 수치 검증 |
| scripts/train.py, configs/, notebooks/ | 로컬/Colab 스모크와 명시적 학습 실행 |
| tests/, src/tests/, e2e/, e2e-static/ | Python·Vitest·Playwright·정적 하위 경로 검사 |
| web/, scripts/web_server.py | 보존한 이전 Python API UI |

웹은 서버·CDN 없이 동작한다. ONNX WASM은 모델 연결 시 번들 내부에서 지연 로드한다. 모델과 결과는 사용자가 로컬에서 불러오거나 다운로드한다. 공개 호스팅에 학습 체크포인트를 포함하지 않는다.

Python과 TS의 규칙은 수순별 테스트로 비교한다. 난수 생성기와 AI 구현은 동일하지 않으므로 같은 시드의 AI 착수까지 언어 간 동일하다고 주장하지 않는다. Python 모델을 ONNX로 옮기는 경우에는 배치 출력과 브라우저 정책·가치를 수치 비교한다.

무르기·재시작·기보 변경·일시정지는 Worker를 종료하고 세대 번호로 이전 응답을 폐기한다. 모델은 새 Worker에 복원한 뒤 추론한다. Arena는 설정을 고정하고 선후공을 교대하며 완료된 대국만 통계에 추가한다. 취소된 부분 대국은 결과에 포함하지 않는다.
