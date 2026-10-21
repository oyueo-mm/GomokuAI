// Offline head-to-head harness: npx vite-node scripts/ts/arena.ts -- <size> <level> <pairs> [A:B ...]
// Each pair plays one randomized 2-ply opening twice with colors swapped. Budgets omit wall-clock limits
// (timeMs is huge) so results depend on depth/simulations, not machine speed.
import { Game, seeded } from '../../src/engine';
import * as current from '../../src/ai';
import * as baseline from './baseline_ai';

type Mod = { decide: (g: Game, a: any, b: any) => Promise<any>; levels: Record<string, any> };
const mods: Record<string, Mod> = { cur: current as any, old: baseline as any };
if (process.env.TUNE) Object.assign(current.tuning, JSON.parse(process.env.TUNE));
const [size = '9', level = 'easy', pairs = '6', ...matchups] = process.argv.slice(2).filter(a => a !== '--');
const n = Number(size);

function parse(spec: string) { const [mod, alg] = spec.split('/'); return { mod, alg, label: spec }; }
async function game(black: ReturnType<typeof parse>, white: ReturnType<typeof parse>, opening: number[], seed: number) {
  const g = Game.replay(n, opening); const stat = { ms: [0, 0], nodes: [0, 0], moves: [0, 0] };
  while (!g.done) {
    const side = g.player === 1 ? 0 : 1, who = side ? white : black, m = mods[who.mod];
    const budget = { ...m.levels[level], timeMs: 1e9, seed: seed + g.moves.length };
    const t = performance.now(); const d = await m.decide(g, who.alg, budget);
    stat.ms[side] += performance.now() - t; stat.nodes[side] += d.nodes; stat.moves[side]++;
    g.play(d.action);
  }
  return { winner: g.winner, plies: g.moves.length, stat };
}
function opening(rng: () => number) {
  const c = Math.floor(n / 2), out: number[] = [];
  while (out.length < 2) { const a = (c + Math.floor(rng() * 5) - 2) * n + c + Math.floor(rng() * 5) - 2; if (!out.includes(a)) out.push(a); }
  return out;
}
for (const spec of matchups) {
  const [sa, sb] = spec.split(':'), A = parse(sa), B = parse(sb);
  let w = 0, l = 0, d = 0; const ms = [0, 0], nodes = [0, 0], mv = [0, 0];
  const rng = seeded(7);
  for (let i = 0; i < Number(pairs); i++) {
    const op = opening(rng);
    for (const aBlack of [true, false]) {
      const r = await game(aBlack ? A : B, aBlack ? B : A, op, 100 + i);
      const aSide = aBlack ? 0 : 1, bSide = 1 - aSide;
      ms[0] += r.stat.ms[aSide]; ms[1] += r.stat.ms[bSide]; nodes[0] += r.stat.nodes[aSide]; nodes[1] += r.stat.nodes[bSide]; mv[0] += r.stat.moves[aSide]; mv[1] += r.stat.moves[bSide];
      if (!r.winner) d++; else if ((r.winner === 1) === aBlack) w++; else l++;
    }
  }
  console.log(`${spec.padEnd(28)} ${size}x${size} ${level}: A ${w}W ${l}L ${d}D | ms/move A ${(ms[0] / mv[0]).toFixed(1)} B ${(ms[1] / mv[1]).toFixed(1)} | nodes/move A ${(nodes[0] / mv[0]).toFixed(0)} B ${(nodes[1] / mv[1]).toFixed(0)}`);
}
