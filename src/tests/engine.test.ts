import { describe, it, expect } from 'vitest';
import { Game } from '../engine';
import cases from './parity.json';
describe('Python reference parity', () => {
  for (const [i, test] of cases.entries()) it(`game ${i}, ${test.size}`, () => {
    const g = new Game(test.size);
    for (const s of test.states) { g.play(s.action); expect(g.board).toEqual(s.board); expect([g.player, g.done, g.winner]).toEqual([s.player, s.done, s.winner]); }
  });
});
it('rejects invalid actions atomically and validates loaded records', () => {
  const g = new Game(9); for (const a of [-1, 81, 1.5, NaN]) expect(() => g.play(a)).toThrow();
  g.play(40); expect(() => g.play(40)).toThrow(); expect(g.moves).toEqual([40]);
  expect(() => Game.load({ ...g.record(), moves: [40, 40] })).toThrow();
  expect(Game.load(g.record()).board).toEqual(g.board); expect(g.undo().moves).toEqual([]);
});
it('draw and overline freestyle', () => {
  const draw = Game.replay(3, [0,1,2,3,4,5,6,7,8]); expect(draw.done).toBe(true); expect(draw.winner).toBe(0);
  const g = new Game(9); for (const a of [0,1,2,4,5]) g.board[a] = 1;
  g.play(3); expect(g.line.length).toBe(6); expect(g.winner).toBe(1);
});
