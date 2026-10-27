import type { Lab } from '../useLab';

const charts = [['policy_loss','정책 손실'],['value_loss','가치 손실'],['arena_win_rate','승급 평가 득점률']];

export function TrainingPage({lab}:{lab:Lab}) {
  const {model,logs,loadingModel}=lab;
  return <div className="training">
    <div className="training-cards">
      <section className="card" aria-label="AlphaZero 모델">
        <h2>AlphaZero 모델</h2>
        {model?<p className="muted">{`${model.name} · ${model.board_size}×${model.board_size} · ${model.trained_iterations} iteration · ${model.status==='smoke'?'스모크 모델 / 기력 미검증':'학습 모델 / 별도 기력 평가 필요'}`}</p>:<p className="muted">연결된 모델이 없습니다. AlphaZero는 모델을 연결한 뒤 사용할 수 있습니다.</p>}
        <label className="file-button primary">{loadingModel?'모델 확인 중…':model?'다른 모델 연결':'ONNX + JSON 모델 연결'}<input type="file" accept=".onnx,.json" multiple disabled={loadingModel||lab.arenaBusy||lab.busy} onChange={e=>{void lab.loadNetwork(e.target.files);e.target.value='';}}/></label>
        <p className="caption">scripts.export_model로 내보낸 두 파일을 함께 선택하세요. 추론은 브라우저의 로컬 WASM에서 실행됩니다. AlphaZero는 실험용이며 기력은 검증되지 않았습니다.</p>
      </section>
      <section className="card" aria-label="학습 로그">
        <h2>학습 로그</h2>
        <p className="muted">{logs.length?`${logs.length}개 iteration을 불러왔습니다.`:'학습 log.csv를 열면 손실과 평가 이력이 표시됩니다.'}</p>
        <label className="file-button">학습 log.csv 열기<input type="file" accept=".csv" onChange={e=>{void lab.loadLog(e.target.files?.[0]);e.target.value='';}}/></label>
      </section>
    </div>
    {logs.length>0&&<section className="card" aria-label="학습 곡선">
      <h2>학습 곡선</h2>
      <div className="charts">{charts.map(([key,label])=>{const values=logs.map(r=>r[key]),max=Math.max(...values,1);return <div key={key}><h3>{label}</h3><svg viewBox="0 0 400 140" role="img" aria-label={label}><path d="M10 10V125H390" stroke="#bdbdbd" fill="none"/><polyline fill="none" stroke="#111" strokeWidth="3" points={values.map((v,i)=>`${10+i*380/Math.max(1,values.length-1)},${125-v/max*110}`).join(' ')}/>{values.map((v,i)=><circle key={i} cx={10+i*380/Math.max(1,values.length-1)} cy={125-v/max*110} r="3" fill="#111"><title>{logs[i].iteration}: {v}</title></circle>)}</svg><p className="caption">iteration {logs[0].iteration}–{logs.at(-1)!.iteration} · 마지막 {values.at(-1)?.toFixed(4)}</p></div>;})}</div>
    </section>}
  </div>;
}
