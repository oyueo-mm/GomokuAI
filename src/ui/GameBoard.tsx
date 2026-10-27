import { memo } from 'react';
import type { Game } from '../engine';
import type { Decision } from '../ai';

// Grid lines end at the outer stones' centers like a real board instead of running to the frame.
function edgeClass(action:number,size:number){const r=Math.floor(action/size),c=action%size;return (r===0?'et ':'')+(r===size-1?'eb ':'')+(c===0?'el ':'')+(c===size-1?'er':'');}

export const GameBoard = memo(function GameBoard({game,decision,numbers,heat,locked,onPlay}:{game:Game;decision:Decision|null;numbers:boolean;heat:boolean;locked:boolean;onPlay?:(action:number)=>void}) {
  const candidates=decision?.candidates??[],maxVisits=Math.max(1,...candidates.map(c=>c.visits??0));
  const rankOf=new Map(candidates.map((c,i)=>[c.action,i]));
  return <div className="board-wrap" style={{'--n':game.size} as React.CSSProperties}><div className="board" role="grid" aria-label="오목판" style={{gridTemplateColumns:`repeat(${game.size},1fr)`}}>{game.board.map((p,action)=>{
    const rankIndex=rankOf.get(action),c=rankIndex===undefined?undefined:candidates[rankIndex],order=game.moves.indexOf(action)+1,last=game.moves.at(-1)===action,win=game.line.includes(action);
    const intensity=c?(c.visits!==undefined?c.visits/maxVisits:Math.max(.15,1-rankIndex!/Math.min(10,candidates.length))):0;
    return <button key={action} role="gridcell" aria-label={`${Math.floor(action/game.size)+1}행 ${action%game.size+1}열${p?` ${p===1?'흑':'백'} ${order}수`:''}`} aria-disabled={!!p||game.done||locked} onClick={()=>{if(!p)onPlay?.(action);}} className={'cell '+(last?'last ':'')+(win?'winning ':'')+edgeClass(action,game.size)}><span className="cross"/>{!p&&heat&&c&&<span className="heat" style={{opacity:intensity*.8}}/>}{p!==0&&<span className={`stone ${p===1?'black':'white'}`}>{numbers?order:last?'•':''}</span>}{!p&&heat&&c&&rankIndex!<3&&<span className="heat-label">#{rankIndex!+1}</span>}</button>;
  })}</div></div>;
});
