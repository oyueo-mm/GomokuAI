import { expect, it } from 'vitest';
import { Game, seeded } from '../engine';
import { rank, threat } from '../ai';
import * as reference from '../../scripts/ts/baseline_ai';

it('optimized threat scoring matches the original on random positions', () => {
  const rng = seeded(11);
  for (let trial = 0; trial < 120; trial++) {
    const size = [9, 13, 15][trial % 3], g = new Game(size), stones = 4 + Math.floor(rng() * 40);
    for (let i = 0; i < stones; i++) { const a = Math.floor(rng() * size * size); if (!g.board[a]) g.board[a] = i % 2 ? -1 : 1; }
    for (let k = 0; k < 12; k++) {
      const a = Math.floor(rng() * size * size); if (g.board[a]) continue;
      for (const p of [1, -1]) expect(threat(g, a, p)).toBe(reference.threat(g, a, p));
    }
    g.player = trial % 2 ? -1 : 1;
    expect(rank(g, 10)).toEqual(reference.rank(g, 10));
  }
});
