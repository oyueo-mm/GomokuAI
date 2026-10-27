import { Game, seeded } from './engine';
import { candidates, threat } from './ai';

export const DEMO_SIZE = 13;
/** A demo game that has not ended by this many stones is abandoned and restarted. */
export const DEMO_CAP = 70;

/**
 * Cheap, live move choice for the home demo: one-ply threat scoring only (no tree search), so it never blocks the page.
 * It takes a forced win or block, otherwise leans toward attack so that games actually finish.
 */
export function demoMove(g: Game, rng: () => number) {
  const scored = candidates(g).map(action => ({ action, attack: threat(g, action, g.player), defense: threat(g, action, -g.player) }));
  const win = scored.find(c => c.attack >= 1e8);
  if (win) return win.action;
  const block = scored.filter(c => c.defense >= 1e8);
  const pool = (block.length ? block : scored).map(c => ({ action: c.action, score: c.attack * 1.5 + c.defense }));
  pool.sort((a, b) => b.score - a.score || a.action - b.action);
  const spread = g.moves.length < 6 ? 4 : pool.length > 1 && pool[1].score > pool[0].score * .9 ? 2 : 1;
  return pool[Math.floor(rng() * Math.min(spread, pool.length))].action;
}

export type DemoGame = { seed: number; moves: number[]; line: number[]; winner: number };

/** Plays one demo game to its end; a game that nobody wins by DEMO_CAP stones is reported with winner 0. */
export function playDemo(seed: number): DemoGame {
  const rng = seeded(seed), g = new Game(DEMO_SIZE);
  while (!g.done && g.moves.length < DEMO_CAP) g.play(demoMove(g, rng));
  return { seed, moves: g.moves, line: g.line, winner: g.winner };
}

/** First game from `seed` onward that ends in a real five-in-a-row, so the demo never stalls on an undecided board. */
export function nextDemo(seed: number): DemoGame {
  for (let i = 0; i < 30; i++) { const d = playDemo(seed + i); if (d.winner) return d; }
  return playDemo(seed);
}
