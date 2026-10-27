import { useState, useEffect, useMemo, useRef } from 'react';
import { Game } from './engine';
import { levels } from './ai';
import type { Algorithm, Decision } from './ai';
import { AIClient } from './client';
import type { ModelMetadata } from './neural';
import { arenaOpening } from './experiment';

export type Match = {game:number;aBlack:boolean;winner:number;result:'A'|'B'|'draw';moves:number;millisecondsA:number;millisecondsB:number;nodesA:number;nodesB:number;decisionsA:number;decisionsB:number;seed:number;opening:number[];a:Algorithm;b:Algorithm;level:string;size:number;budget:object;model:string|null};

export function download(name:string,data:string,type='application/json') {const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

/**
 * All match, experiment and model state lives here (above the pages), so switching pages never resets a game or an experiment.
 * The play room and the arena each own their board; only the AI worker, search budget and model are shared.
 */
export function useLab(playActive:boolean) {
  const [game,setGame]=useState(()=>new Game(15)),[mode,setMode]=useState('human-ai'),[human,setHuman]=useState(1);
  const [a,setA]=useState<Algorithm>('heuristic'),[b,setB]=useState<Algorithm>('alphabeta'),[level,setLevel]=useState('normal');
  const [running,setRunning]=useState(true),[busy,setBusy]=useState(false),[decision,setDecision]=useState<Decision|null>(null),[error,setError]=useState('');
  const [numbers,setNumbers]=useState(true),[heat,setHeat]=useState(false),[seed,setSeed]=useState(42);
  const [model,setModel]=useState<ModelMetadata|null>(null),[loadingModel,setLoadingModel]=useState(false);
  const [arenaGame,setArenaGame]=useState(()=>new Game(15)),[arenaDecision,setArenaDecision]=useState<Decision|null>(null),[arenaA,setArenaA]=useState<Algorithm>('heuristic'),[arenaB,setArenaB]=useState<Algorithm>('alphabeta');
  const [results,setResults]=useState<Match[]>([]),[arenaBusy,setArenaBusy]=useState(false),[arenaGames,setArenaGames]=useState(4),[arenaProgress,setArenaProgress]=useState('');
  const [logs,setLogs]=useState<Record<string,number>[]>([]);
  const client=useRef<AIClient|null>(null),stopArena=useRef(false);
  useEffect(()=>{client.current=new AIClient();return()=>client.current?.dispose();},[]);
  const isAI=mode==='ai-ai'||mode==='human-ai'&&game.player!==human;
  useEffect(()=>{
    if(!playActive||!isAI||!running||game.done||arenaBusy||loadingModel)return;
    let active=true;setBusy(true);setError('');
    const algorithm=mode==='human-ai'?a:game.player===1?a:b;
    const timer=setTimeout(()=>{client.current!.request({type:'decide',size:game.size,moves:game.moves,algorithm,budget:{...levels[level],seed:seed+game.moves.length}},d=>{if(active)setDecision(d);}).then(({decision:d})=>{if(active){setDecision(d);setGame(game.clone().play(d.action));}}).catch(e=>{if(active&&e.message!=='cancelled'){setError(e.message);setRunning(false);}}).finally(()=>{if(active)setBusy(false);});},mode==='ai-ai'?180:50);
    return()=>{active=false;clearTimeout(timer);};
  },[playActive,game,mode,human,a,b,level,running,arenaBusy,loadingModel,seed]);
  // Leaving the play room abandons its in-flight search; coming back requests it again instead of applying a stale result.
  useEffect(()=>{if(!playActive&&busy)void cancel();},[playActive,busy]);
  async function cancel(){setBusy(false);setDecision(null);try{await client.current!.cancel();}catch(e){setError(String(e));}}
  function restart(size=game.size){void cancel();setGame(new Game(size));setError('');setRunning(true);}
  function play(action:number){if(game.done||isAI||busy||arenaBusy)return;setDecision(null);setGame(game.clone().play(action));}
  function undo(){void cancel();setGame(game.undo(mode==='human-ai'&&game.moves.length>1&&!isAI?2:1));setRunning(false);}
  function togglePause(){if(running){setRunning(false);void cancel();}else setRunning(true);}
  function setPlaySize(size:number){if(model&&model.board_size!==size&&(a==='alphazero'||b==='alphazero')){setA('heuristic');setB('alphabeta');}restart(size);}
  function setPlayMode(next:string){setMode(next);restart();}
  function setHumanSide(side:number){setHuman(side);restart();}
  async function loadRecord(file?:File){if(!file)return;try{const next=Game.load(JSON.parse(await file.text()));await cancel();setGame(next);setRunning(false);setError('');}catch(e){setError(String(e));}}
  async function loadNetwork(files:FileList|null){if(!files||files.length!==2){setError('ONNX와 JSON 메타데이터 파일을 함께 선택하세요');return;}setLoadingModel(true);setRunning(false);try{const onnx=[...files].find(f=>f.name.endsWith('.onnx')),meta=[...files].find(f=>f.name.endsWith('.json'));if(!onnx||!meta)throw Error('ONNX + JSON 파일 필요');await cancel();const metadata=JSON.parse(await meta.text());await client.current!.load(await onnx.arrayBuffer(),metadata);setModel(metadata);setError('');}catch(e){setError(String(e));}finally{setLoadingModel(false);}}
  async function loadLog(file?:File){if(!file)return;try{const text=await file.text();const lines=text.trim().split(/\r?\n/),header=lines.shift()!.split(',');if(!header.includes('policy_loss')||!header.includes('arena_win_rate'))throw Error('학습 log.csv 형식이 아닙니다');const rows=lines.map(line=>Object.fromEntries(line.split(',').map((v,i)=>[header[i],Number(v)])));if(rows.some(r=>!Number.isFinite(r.policy_loss)||!Number.isFinite(r.value_loss)||!Number.isFinite(r.arena_win_rate)))throw Error('유효하지 않은 학습 지표');setLogs(rows);setError('');}catch(e){setError(String(e));}}
  function setArenaSize(size:number){
    if(arenaBusy)return;
    if(model&&model.board_size!==size){if(arenaA==='alphazero')setArenaA('heuristic');if(arenaB==='alphazero')setArenaB('alphabeta');}
    setArenaGame(new Game(size));setArenaDecision(null);
  }
  async function arena(){
    const size=arenaGame.size;
    setArenaBusy(true);setRunning(false);stopArena.current=false;await cancel();setResults([]);setArenaDecision(null);setError('');const collected:Match[]=[];
    try{for(let i=0;i<arenaGames&&!stopArena.current;i++){
      const opening=arenaOpening(size,seed+Math.floor(i/2)),g=Game.replay(size,opening),aBlack=i%2===0,stats={millisecondsA:0,millisecondsB:0,nodesA:0,nodesB:0,decisionsA:0,decisionsB:0};
      setArenaGame(g.clone());
      while(!g.done&&!stopArena.current){const side=((g.player===1)===aBlack)?'A':'B';const algorithm=side==='A'?arenaA:arenaB;const {decision:d}=await client.current!.request({type:'decide',size:g.size,moves:g.moves,algorithm,budget:{...levels[level],seed:seed+Math.floor(i/2)*1000+g.moves.length}});stats[side==='A'?'millisecondsA':'millisecondsB']+=d.elapsed;stats[side==='A'?'nodesA':'nodesB']+=d.nodes;stats[side==='A'?'decisionsA':'decisionsB']++;g.play(d.action);setArenaGame(g.clone());setArenaDecision(d);setArenaProgress(`${i+1}/${arenaGames} · ${g.moves.length}수`);}
      if(stopArena.current)break;
      collected.push({game:i+1,aBlack,winner:g.winner,result:g.winner===0?'draw':((g.winner===1)===aBlack)?'A':'B',moves:g.moves.length,...stats,opening,seed:seed+Math.floor(i/2)*1000,a:arenaA,b:arenaB,level,size:g.size,budget:levels[level],model:model?.sha256??null});setResults([...collected]);
    }}catch(e){if(!stopArena.current)setError(String(e));}finally{setArenaBusy(false);setArenaProgress('');}
  }
  async function stopArenaRun(){stopArena.current=true;try{await client.current!.cancel();}catch(e){setError(String(e));}}
  function pickPlayAlgorithm(side:'a'|'b',value:Algorithm){(side==='a'?setA:setB)(value);setDecision(null);}
  function pickArenaAlgorithm(side:'a'|'b',value:Algorithm){(side==='a'?setArenaA:setArenaB)(value);setArenaDecision(null);}
  // One pass per render instead of two linear scans per cell (225 cells x up to 225 candidates on 15x15).
  const candidateRank=useMemo(()=>new Map((decision?.candidates??[]).map((c,i)=>[c.action,i])),[decision]);
  return {game,mode,human,a,b,level,setLevel,running,busy,decision,error,setError,numbers,setNumbers,heat,setHeat,seed,setSeed,model,loadingModel,isAI,candidateRank,
    arenaGame,arenaDecision,arenaA,arenaB,results,arenaBusy,arenaGames,setArenaGames,arenaProgress,logs,
    restart,play,undo,togglePause,setPlaySize,setPlayMode,setHumanSide,loadRecord,loadNetwork,loadLog,setArenaSize,arena,stopArenaRun,pickPlayAlgorithm,pickArenaAlgorithm};
}
export type Lab = ReturnType<typeof useLab>;
