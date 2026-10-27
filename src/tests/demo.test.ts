import { expect, it } from 'vitest';
import { DEMO_CAP, DEMO_SIZE, nextDemo, playDemo } from '../demo';
import { Game } from '../engine';

it('every demo is a legal game that ends in a real five-in-a-row', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const d = nextDemo(seed), g = Game.replay(DEMO_SIZE, d.moves);
    expect(d.moves.length).toBeLessThanOrEqual(DEMO_CAP);
    expect(g.done).toBe(true);
    expect(g.winner).toBe(d.winner);
    expect(d.winner).not.toBe(0);
    expect(d.line).toEqual(g.line);
    expect(d.line.length).toBeGreaterThanOrEqual(5);
  }
});

it('is deterministic for a seed', () => {
  expect(playDemo(3)).toEqual(playDemo(3));
});
