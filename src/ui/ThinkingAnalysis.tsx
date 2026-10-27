import { labels } from '../ai';
import type { Decision } from '../ai';

export function ThinkingAnalysis({decision,size}:{decision:Decision|null;size:number}) {
  const visits=decision?.algorithm==='mcts'||decision?.algorithm==='alphazero';
  return <section className="card analysis" aria-label="착수 분석">
    <h2>착수 분석</h2>
    {decision?<>
      <div className="metrics"><div><b>{decision.elapsed.toFixed(0)}<small>ms</small></b><span>사고 시간</span></div><div><b>{decision.nodes.toLocaleString()}</b><span>탐색 노드</span></div><div><b>{decision.simulations||decision.depth||'—'}</b><span>{visits?'시뮬레이션':'완료 깊이'}</span></div></div>
      <p className="muted">{labels[decision.algorithm]} · 가지치기 {decision.cutoffs}회{decision.model?` · ${decision.model}`:''}</p>
      <div className="candidate-list">{decision.candidates.slice(0,6).map((c,i)=><div key={c.action}><span className="rank">{i+1}</span><b>{String.fromCharCode(65+c.action%size)}{Math.floor(c.action/size)+1}</b><span className="bar"><i style={{width:`${c.probability!==undefined?c.probability*100:100-i*14}%`}}/></span><span>{c.visits!==undefined?`${c.visits}회 · ${(100*(c.probability??0)).toFixed(1)}%`:c.score.toFixed(0)}</span></div>)}</div>
      <p className="caption">{visits?'막대는 루트 방문 비율입니다.':'휴리스틱 점수는 승률이 아닙니다.'}</p>
    </>:<p className="empty">아직 분석 결과가 없습니다.</p>}
  </section>;
}
