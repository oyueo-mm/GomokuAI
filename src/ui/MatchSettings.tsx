import { levels } from '../ai';
import type { Lab } from '../useLab';
import { AlgorithmSelect, Segmented, alphaZeroNote } from './controls';

export const budgetLabels: Record<string,string> = {easy:'가볍게',normal:'표준',hard:'깊게'};

/** Search budget and seed. Shared by the play room (collapsed under 고급 설정) and the arena (always visible). */
export function BudgetFields({lab,disabled}:{lab:Lab;disabled:boolean}) {
  return <div className="two"><label className="field">탐색 예산<select value={lab.level} disabled={disabled} onChange={e=>lab.setLevel(e.target.value)}>{Object.keys(levels).map(id=><option key={id} value={id}>{budgetLabels[id]}</option>)}</select></label><label className="field">시드<input type="number" value={lab.seed} disabled={disabled} onChange={e=>lab.setSeed(Number(e.target.value)||0)}/></label></div>;
}

export function MatchSettings({lab}:{lab:Lab}) {
  const {game,mode,arenaBusy,busy}=lab,locked=arenaBusy||busy,aiMode=mode!=='human-human';
  return <section className="card settings" aria-label="대국 설정">
    <h2>대국 설정</h2>
    <div className="fields">
      <Segmented label="대국 방식" value={mode} disabled={locked} onChange={lab.setPlayMode} options={[{value:'human-ai',label:'사람 vs AI'},{value:'ai-ai',label:'AI vs AI'},{value:'human-human',label:'사람 vs 사람'}]}/>
      <Segmented label="보드 크기" value={game.size} disabled={locked} onChange={lab.setPlaySize} options={[9,13,15].map(s=>({value:s,label:`${s} × ${s}`}))}/>
      {mode==='human-ai'&&<Segmented label="내 돌" value={lab.human} disabled={busy} onChange={lab.setHumanSide} options={[{value:1,label:'흑 · 선공'},{value:-1,label:'백 · 후공'}]}/>}
      {aiMode&&<AlgorithmSelect name={mode==='ai-ai'?'흑 알고리즘':'AI 알고리즘'} value={lab.a} disabled={locked} model={lab.model} size={game.size} onChange={v=>lab.pickPlayAlgorithm('a',v)}/>}
      {mode==='ai-ai'&&<AlgorithmSelect name="백 알고리즘" value={lab.b} disabled={locked} model={lab.model} size={game.size} onChange={v=>lab.pickPlayAlgorithm('b',v)}/>}
      {alphaZeroNote(aiMode&&(lab.a==='alphazero'||mode==='ai-ai'&&lab.b==='alphazero'))}
    </div>
    {aiMode&&<details className="fold"><summary>고급 설정</summary><BudgetFields lab={lab} disabled={locked}/></details>}
    <details className="fold"><summary>규칙</summary><p className="muted">자유형 · 5개 이상 연결 승리 · 렌주 금수 미지원</p></details>
  </section>;
}
