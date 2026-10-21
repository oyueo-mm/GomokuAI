import { test,expect } from '@playwright/test';
import fs from 'node:fs';
test('six real worker AIs: paired games, legal moves and measured responsiveness',async({page})=>{
  test.setTimeout(180000);test.skip(!fs.existsSync('checkpoints/web-smoke/gomoku9-smoke.onnx'),'Generate the smoke model first');
  await page.goto('/');
  const output=await page.evaluate(async()=>{
    const {AIClient}=await import('/src/client.ts');const {Game}=await import('/src/engine.ts');const {levels}=await import('/src/ai.ts');
    const client=new AIClient();const metadata=await fetch('/checkpoints/web-smoke/gomoku9-smoke.json').then(r=>r.json());await client.load(await fetch('/checkpoints/web-smoke/gomoku9-smoke.onnx').then(r=>r.arrayBuffer()),metadata);
    const rows:any[]=[];let last=performance.now(),maxMainThreadGapMs=0;const timer=setInterval(()=>{const now=performance.now();maxMainThreadGapMs=Math.max(maxMainThreadGapMs,now-last);last=now;},10);
    for(const algorithm of ['random','heuristic','minimax','alphabeta','mcts','alphazero'])for(let i=0;i<2;i++){
      const game=new Game(9),aBlack=i===0;let nodes=0,milliseconds=0,turns=0,simulations=0,maxMoveMs=0;
      while(!game.done){const isA=(game.player===1)===aBlack;const {decision:d}=await client.request({type:'decide',size:9,moves:game.moves,algorithm:isA?algorithm:'random',budget:{...levels.easy,seed:42+game.moves.length}});if(!game.legal(d.action))throw Error('Illegal worker action');game.play(d.action);if(isA){nodes+=d.nodes;milliseconds+=d.elapsed;turns++;simulations+=d.simulations;maxMoveMs=Math.max(maxMoveMs,d.elapsed);}}
      rows.push({algorithm,opponent:'random',boardSize:9,seed:42,budget:levels.easy,aBlack,result:game.winner===0?'draw':((game.winner===1)===aBlack)?'A':'B',moves:game.moves.length,nodes,simulations,turns,milliseconds,averageMoveMs:milliseconds/turns,maxMoveMs,model:algorithm==='alphazero'?metadata:null});
    }
    clearInterval(timer);client.dispose();return {userAgent:navigator.userAgent,rows,maxMainThreadGapMs};
  });
  expect(output.rows).toHaveLength(12);expect(output.rows.every((r:any)=>r.moves>0&&r.turns>0)).toBe(true);
  fs.mkdirSync('test-results',{recursive:true});
  fs.writeFileSync('test-results/benchmark.json',JSON.stringify({version:1,sampleWarning:'Two games per algorithm, exploratory only; node definitions differ by algorithm',...output},null,2));
  console.log(JSON.stringify({maxMainThreadGapMs:output.maxMainThreadGapMs,summary:output.rows.map((r:any)=>({algorithm:r.algorithm,aBlack:r.aBlack,result:r.result,averageMoveMs:r.averageMoveMs}))}));
});
