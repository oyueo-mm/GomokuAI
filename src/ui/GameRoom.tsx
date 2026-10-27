import type { Lab } from '../useLab';
import { download } from '../useLab';
import { GameBoard } from './GameBoard';
import { MatchSettings } from './MatchSettings';
import { ThinkingAnalysis } from './ThinkingAnalysis';
import { PauseIcon, PlayIcon, RestartIcon, UndoIcon } from './controls';

export function GameRoom({lab}:{lab:Lab}) {
  const {game,busy,arenaBusy,loadingModel,running}=lab;
  const status=arenaBusy?'Arena 실험 진행 중':game.done?(game.winner?`${game.winner===1?'흑':'백'} 승리`:'무승부'):busy?'AI 생각 중…':`${game.player===1?'흑':'백'} 차례`;
  return <div className="workspace-grid room">
    <section className="board-area" aria-label="대국판">
      <div className="board-head"><span className="size-label">{game.size} × {game.size}</span><span className={'status '+(game.done?'finished':'')} aria-live="polite">{status}</span></div>
      <GameBoard game={game} decision={lab.decision} numbers={lab.numbers} heat={lab.heat} locked={lab.isAI||arenaBusy||busy} onPlay={lab.play}/>
      <div className="board-foot"><span><i className="dot black"/> 흑 선공 <span className="separator">/</span> {game.moves.length}수</span><div><label><input type="checkbox" checked={lab.numbers} onChange={e=>lab.setNumbers(e.target.checked)}/> 수순</label><label><input type="checkbox" checked={lab.heat} onChange={e=>lab.setHeat(e.target.checked)}/> 후보 히트맵</label></div></div>
      <div className="toolbar">
        <button disabled={!game.moves.length||arenaBusy} onClick={lab.undo}><UndoIcon/>무르기</button>
        <button disabled={arenaBusy} onClick={()=>lab.restart()}><RestartIcon/>새 대국</button>
        <button disabled={arenaBusy||loadingModel} onClick={lab.togglePause}>{running?<><PauseIcon/>일시정지</>:<><PlayIcon/>계속</>}</button>
        <span className="toolbar-gap"/>
        <button onClick={()=>download('gomoku-record.json',JSON.stringify(game.record(),null,2))}>기보 저장</button>
        <label className="file-button">기보 불러오기<input type="file" accept=".json" disabled={arenaBusy} onChange={e=>{void lab.loadRecord(e.target.files?.[0]);e.target.value='';}}/></label>
      </div>
      <details className="moves"><summary>기보 · {game.moves.length}수</summary><div>{game.moves.map((a,i)=><span key={i}>{i+1}. {String.fromCharCode(65+a%game.size)}{Math.floor(a/game.size)+1}</span>)}</div></details>
    </section>
    <aside className="side-panel"><MatchSettings lab={lab}/><ThinkingAnalysis decision={lab.decision} size={game.size}/></aside>
  </div>;
}
