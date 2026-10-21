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
  const g=Game.replay(9,[40,41,30,50]);const cfg={...budget,timeMs:10000,width:5};const m=await decide(g,'minimax',cfg),a=await decide(g,'alphabeta',cfg);expect(a.depth).toBe(2);expect(a.action).toBe(m.action);expect(a.candidates.map(c=>[c.action,c.score])).toEqual(m.candidates.map(c=>[c.action,c.score]));
});
it('random is seeded, legal; absent AlphaZero fails clearly',async()=>{const g=new Game(9);expect((await decide(g,'random',budget)).action).toBe((await decide(g,'random',budget)).action);await expect(decide(g,'alphazero',budget)).rejects.toThrow('모델');});
