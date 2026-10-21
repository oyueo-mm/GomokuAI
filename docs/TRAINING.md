# AlphaZero: VS Code + Colab

원본 `alphazero/`와 노트북은 GitHub `master`의 `20e5e1c`에서 복구했다. 복구 전 체크포인트는 로컬과 원격 저장소에서 발견되지 않았다. 이번 CPU 스모크 결과는 `checkpoints/`에 별도로 생성했으며 Git에서 제외한다.

## 런타임 연결

1. Google의 [Colab VS Code 확장](https://github.com/googlecolab/colab-vscode)을 설치한다.
2. `notebooks/colab_vscode_smoke.ipynb`를 열고 `Select Kernel → Colab → Auto Connect`로 로그인한다. GPU 서버는 커널 선택 흐름에서 고른다. CPU 서버를 교체하려면 `Colab: Remove Server` 후 GPU 서버를 선택한다.
3. 이 개발 브랜치의 파일을 Colab 런타임 또는 Drive에 복사한다. 로컬 Windows 경로는 원격 런타임에 자동 공유되지 않는다. `node_modules`, `.git`, 테스트 임시 폴더는 필요 없다. 체크포인트는 Drive 등 영속 저장소에 둔다.
4. 노트북의 프로젝트·체크포인트 경로를 수정한다. `torch.cuda.is_available()`와 GPU 이름을 확인한다. 노트북에는 짧은 스모크만 있다. 장시간 학습은 별도 승인 후 설정을 결정한다.

연결은 [공식 안내](https://github.com/googlecolab/colab-vscode#quick-start), GPU 서버 교체는 [공식 저장소 안내](https://github.com/googlecolab/colab-vscode/discussions/265)를 따른다.

## 실행과 재개

```sh
python -m pip install -r requirements-export.txt
python -m scripts.train --config configs/colab-smoke.json --require-cuda
python -m scripts.benchmark_inference --device cuda --output results/inference-gpu.json
```

설정 JSON의 `checkpoint_dir`를 영속 경로로 바꾼다. 재개 시 `total_iterations`는 추가 횟수가 아닌 전체 목표 횟수다. 1회 완료 후 2로 바꾸고 `--resume`을 붙이면 1회만 추가한다. 새 실행이 기존 디렉터리를 덮어쓰려 하면 오류가 난다.

로컬 CPU 웹 모델 스모크:

```sh
python -m scripts.train_smoke_web
python -m scripts.train_smoke_web --resume
python -m scripts.evaluate_checkpoint --checkpoint checkpoints/web-smoke/latest.pt --sims 8 --games 4 --opponent tactical --output results/smoke-eval.csv
```

기존 `scripts.alphazero_smoke`는 5×5/4목 검사이며 웹 5목 모델로 쓸 수 없다. `train_smoke_web`는 9×9/5목, 8채널·1블록, 2게임·2 SGD 스텝의 작은 검사다.

## 정확성과 성능

- Python MCTS는 자식의 다음 차례 관점 Q를 부호 반전하여 PUCT로 선택한다. 터미널 값은 승리한 착수 다음 관점의 -1이다. 게임 객체는 종국에 착수자 색을 유지하므로 터미널 인코딩을 신경망에 넣지 않는다.
- 합법 수 마스킹, Dirichlet 노이즈, 배치 추론, Virtual Loss 회수, 중복 리프 재확장 방지, 방문 정책 타깃, 승자 가치 타깃을 검사한다.
- `parallel_games`는 여러 게임의 리프를 합치는 동시 게임 배치다. 별도 CPU 프로세스를 생성하지 않는다. `sim_batch`와 곱해 GPU 추론 배치를 만든다. 보드 진행·선택은 Python CPU 루프다.
- D4 대칭 8종 중 하나를 버퍼 추가 시 균등 추출한다. 모든 8종을 매번 저장하지 않는다. Replay Buffer는 FIFO이며 미니배치는 복원 추출한다.
- `latest.pt`는 후보·최고 모델, 옵티마이저, Replay Buffer, 설정, NumPy·Torch·CUDA RNG를 포함하는 원자적 스냅샷이다. 마지막 완료 스냅샷부터 재개한다. `best.pt`, `buffer.npz`는 보조 내보내기이며 손상돼도 새 형식 `latest.pt`에서 복원한다. 버퍼까지 포함하므로 저장 용량은 늘어난다.
- 이전 체크포인트는 보조 파일을 사용하는 호환 경로가 있다. RNG가 없는 이전 형식은 정확한 재현을 보장하지 않는다.
- CPU에서 2회 연속 실행과 1회 후 재개한 가중치의 비트 단위 일치를 검증했다. GPU 비트 단위 재현은 미검증이다.
- 승급 평가는 선후공 교대, 무승부 0.5점으로 처리한다. 소표본 승급 결과로 일반 기력을 주장하지 않는다.
- `log.csv`에는 손실·평가 득점률·승급·시간·추론 배치 수/크기·셀프플레이 처리량을, `run.json`에는 설정·장치·버전을 기록한다. 기존 로그에 새 열을 추가할 때 헤더를 갱신한다.

## 웹 내보내기

```sh
python -m scripts.export_model --checkpoint checkpoints/web-smoke/latest.pt --output checkpoints/web-smoke/gomoku9-smoke.onnx
```

기존 출력이 있으면 새 이름을 쓴다. exporter는 PyTorch/ONNX Runtime 배치 1/3 동치성을 검사하고 `.onnx`, `.json`, `.parity.json`을 만든다. 웹 **학습 분석 → ONNX + JSON 모델 연결**에서 `.onnx`와 `.json`을 함께 선택한다. `.parity.json`은 브라우저 수치 검사에 쓴다.

보드 크기가 일치하고 5목이며 적어도 한 번 학습한 메타데이터가 있어야 연결한다. 기본 상태 `smoke`는 기력 미검증으로 표시한다. `--status trained`도 강함을 인증하지 않는다. 원본 순수 `best.pt`만 내보낼 때는 `--config`가 필요하며, 학습 이력이 없는 가중치는 웹 연결 대상이 아니다. 학습된 후보는 `latest.pt`로 내보내고 별도 대국 평가를 병행한다.

브라우저는 SHA-256을 확인하고 Worker 안에서 WASM 단일 스레드로 추론한다. [ONNX Runtime 공식 설정](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html)에 따라 WASM 경로를 번들 자산으로 지정한다. CDN·외부 추론 서버는 필요 없다. WASM 약 14.2MB는 모델 연결 시 지연 로드한다. WebGPU는 구현·검증하지 않았다.

이번 환경은 `torch 2.14.1+cpu`, CUDA 없음이다. CPU 학습·재개·평가와 브라우저 추론을 검증했고 **Colab GPU 실행·GPU 처리량은 아직 검증하지 않았다.**
