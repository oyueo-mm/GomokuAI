import type { Lab } from '../useLab';
import { download } from '../useLab';
import { encodeCsv } from '../experiment';
import { GameBoard } from './GameBoard';
import { BudgetFields } from './MatchSettings';
import { ThinkingAnalysis } from './ThinkingAnalysis';
import { AlgorithmSelect, PlayIcon, Segmented } from './controls';

export function ArenaPage({lab}:{lab:Lab}) {
  const {arenaGame:game,arenaBusy:running,results,loadingModel}=lab;
  const sum=(f:(r:typeof results[number])=>number)=>results.reduce((s,r)=>s+f(r),0);
  const per=(total:number,count:number,digits:number)=>(total/Math.max(1,count)).toFixed(digits);
  const point=(r:typeof results[number])=>r.result==='A'?1:r.result==='draw'?.5:0;
  const scoreA=sum(point);
  const sideScore=(black:boolean)=>{const rows=results.filter(r=>r.aBlack===black);return rows.length?((rows.reduce((s,r)=>s+point(r),0)/rows.length)*100).toFixed(1)+'%':'?';};
  const status=running?lab.arenaProgress||'준비 중…':game.done?(game.winner?`${game.winner===1?'흑':'백'} 승리`:'무승부'):'대기 중';
  return <div className="arena">
    <div className="workspace-grid room">
      <section className="board-area" aria-label="Arena 대국판">
        <div className="board-head"><span className="size-label">{game.size} × {game.size}</span><span className={'status '+(running?'live':'')} aria-live="polite">{status}</span></div>
        <GameBoard game={game} decision={lab.arenaDecision} numbers={lab.numbers} heat={false} locked/>
        <div className="board-foot"><span><i className="dot black"/> 흑 선공 <span className="separator">/</span> {game.moves.length}수</span><div><label><input type="checkbox" checked={lab.numbers} onChange={e=>lab.setNumbers(e.target.checked)}/> 수순</label></div></div>
      </section>
      <aside className="side-panel">
        <section className="card settings" aria-label="실험 설정">
          <h2>AI Arena</h2>
          <div className="fields">
            <AlgorithmSelect name="알고리즘 A" value={lab.arenaA} disabled={running} model={lab.model} size={game.size} onChange={v=>lab.pickArenaAlgorithm('a',v)}/>
            <AlgorithmSelect name="알고리즘 B" value={lab.arenaB} disabled={running} model={lab.model} size={game.size} onChange={v=>lab.pickArenaAlgorithm('b',v)}/>
            <Segmented label="보드 크기" value={game.size} disabled={running} onChange={lab.setArenaSize} options={[9,13,15].map(s=>({value:s,label:`${s} × ${s}`}))}/>
            <label className="field">대국 수<select value={lab.arenaGames} disabled={running} onChange={e=>lab.setArenaGames(Number(e.target.value))}>{[2,4,10,20].map(n=><option key={n}>{n}</option>)}</select></label>
            <BudgetFields lab={lab} disabled={running}/>
          </div>
          <p className="muted">두 대국을 한 쌍으로, 같은 시작 국면에서 선후공을 바꿔 둡니다.</p>
          <div className="actions">
            <button className="primary" disabled={running||loadingModel} onClick={()=>void lab.arena()}><PlayIcon/>비교 실험 시작</button>
            {running&&<button onClick={()=>void lab.stopArenaRun()}>실험 중지</button>}
          </div>
        </section>
        {lab.arenaDecision&&<ThinkingAnalysis decision={lab.arenaDecision} size={game.size}/>}
      </aside>
    </div>
    {(results.length>0||running)&&<section className="card results" aria-label="실험 결과">
      <div className="results-head"><h2>실험 기록 <span>{results.length} 대국</span></h2><div><button disabled={!results.length} onClick={()=>download('arena.json',JSON.stringify({version:1,createdAt:new Date().toISOString(),results},null,2))}>JSON ↓</button><button disabled={!results.length} onClick={()=>{download('arena.csv',encodeCsv(results as unknown as Record<string,unknown>[]),'text/csv');}}>CSV ↓</button></div></div>
      {results.length?<>
        <div className="summary-stats"><b>A 득점률 {(scoreA/results.length*100).toFixed(1)}%</b><span>흑 승 {results.filter(r=>r.winner===1).length} · 백 승 {results.filter(r=>r.winner===-1).length} · 무승부 {results.filter(r=>!r.winner).length}</span><span>A 평균 {per(sum(r=>r.millisecondsA),sum(r=>r.decisionsA),1)}ms/수</span><span>B 평균 {per(sum(r=>r.millisecondsB),sum(r=>r.decisionsB),1)}ms/수</span></div>
        <div className="summary-stats"><span>A 흑 득점률 {sideScore(true)}</span><span>A 백 득점률 {sideScore(false)}</span><span>A 승률 {(100*results.filter(r=>r.result==='A').length/results.length).toFixed(1)}%</span><span>A 평균 {per(sum(r=>r.nodesA),sum(r=>r.decisionsA),0)}노드/수</span><span>B 평균 {per(sum(r=>r.nodesB),sum(r=>r.decisionsB),0)}노드/수</span></div>
        <p className="caption">소표본 결과는 일반적인 기력 순위를 입증하지 않습니다. 시간 제한에서는 장치 성능에 따라 실제 탐색량이 달라집니다.</p>
        <div className="table-scroll"><table><thead><tr><th>대국</th><th>A 색상</th><th>승자</th><th>수순</th><th>A 노드</th><th>B 노드</th></tr></thead><tbody>{results.map(r=><tr key={r.game}><td>{r.game}</td><td>{r.aBlack?'흑':'백'}</td><td>{r.result}</td><td>{r.moves}</td><td>{r.nodesA}</td><td>{r.nodesB}</td></tr>)}</tbody></table></div>
      </>:<p className="empty">첫 대국이 끝나면 결과가 기록됩니다.</p>}
    </section>}
  </div>;
}
