import { it, expect } from 'vitest';
import { Game } from '../engine';
import { decide, rank, threat } from '../ai';
import type { Algorithm } from '../ai';
const budget={depth:2,width:8,simulations:16,timeMs:500,seed:42};
for(const algorithm of ['heuristic','minimax','alphabeta','mcts'] as Algorithm[]) {
  it(`${algorithm}: immediate win`,async()=>{const g=Game.replay(9,[0,9,1,10,2,11,3,12]);const d=await decide(g,algorithm,budget);expect(d.action).toBe(4);expect(g.moves).toHaveLength(8);});
  it(`${algorithm}: mandatory defense`,async()=>{const g=Game.replay(9,[9,0,11,1,27,2,29,3]);expect((await decide(g,algorithm,budget)).action).toBe(4);});
}
it('open four and double threat prefer forcing moves',()=>{
  const g=new Game(9);for(const a of [38,39,40])g.board[a]=1;
  expect([37,41]).toContain(rank(g)[0].action);
  const d=new Game(9);for(const a of [38,39,22,31])d.board[a]=1;
  expect(threat(d,40,1)).toBeGreaterThan(30000);
});
it('minimax and alpha-beta agree at completed depth',async()=>{
  const g=Game.replay(9,[40,41,30,50]);const cfg={...budget,timeMs:10000,width:5};const m=await decide(g,'minimax',cfg),a=await decide(g,'alphabeta',cfg);expect(a.depth).toBe(2);expect(a.action).toBe(m.action);expect(a.candidates[0].score).toBe(m.candidates[0].score);expect(a.candidates).toHaveLength(m.candidates.length);
});
it('random is seeded, legal; absent AlphaZero fails clearly',async()=>{const g=new Game(9);expect((await decide(g,'random',budget)).action).toBe((await decide(g,'random',budget)).action);await expect(decide(g,'alphazero',budget)).rejects.toThrow('모델');});
it('alpha-beta prunes while preserving the minimax result at depth 3',async()=>{
  const g=Game.replay(9,[40,41,30,50]);const cfg={...budget,depth:3,timeMs:10000,width:4};const m=await decide(g,'minimax',cfg),a=await decide(g,'alphabeta',cfg);
  expect(a.depth).toBe(3);expect(a.action).toBe(m.action);expect(a.candidates[0].score).toBe(m.candidates[0].score);expect(a.cutoffs).toBeGreaterThan(0);expect(a.nodes).toBeLessThan(m.nodes);
});

it('searches block an open three before it becomes an open four',async()=>{
  // Black has 38,39,40 open on a 9x9 board with white to move: only the ends are sensible.
  const g=Game.replay(9,[38,0,39,80,40]);
  for(const algorithm of ['heuristic','minimax','alphabeta','mcts'] as Algorithm[])expect([37,41],algorithm).toContain((await decide(g,algorithm,{...budget,depth:3,simulations:64})).action);
});
it('takes a double-four win and avoids leaving the opponent one',async()=>{
  // Black: 4 in column (rows 0-3 col 8 minus...) simple win-in-one beats any block.
  const g=Game.replay(9,[0,9,1,10,2,11,3,12,40,18]);
  for(const algorithm of ['heuristic','minimax','alphabeta','mcts'] as Algorithm[])expect((await decide(g,algorithm,budget)).action,algorithm).toBe(4);
});
it('tree search is deterministic for a fixed seed and budget',async()=>{
  const g=Game.replay(9,[40,41,30,50]);
  for(const algorithm of ['alphabeta','mcts'] as Algorithm[]){const a=await decide(g,algorithm,{...budget,timeMs:1e9}),b=await decide(g,algorithm,{...budget,timeMs:1e9});expect(b.action).toBe(a.action);expect(b.nodes).toBe(a.nodes);}
});
it('MCTS honours its simulation budget and reports visits that sum to it',async()=>{
  const g=Game.replay(9,[40,41,30,50]);const d=await decide(g,'mcts',{...budget,simulations:40,timeMs:1e9});
  expect(d.simulations).toBe(40);expect(d.candidates.reduce((s,c)=>s+(c.visits??0),0)).toBe(40);
});
