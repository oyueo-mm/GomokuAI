import { Game, directions, seeded, winningLine } from './engine';
export type Algorithm = 'random' | 'heuristic' | 'minimax' | 'alphabeta' | 'mcts' | 'alphazero';
export const labels: Record<Algorithm, string> = { random: 'Random', heuristic: 'Heuristic', minimax: 'Minimax', alphabeta: 'Alpha-Beta', mcts: 'MCTS', alphazero: 'AlphaZero' };
export type Budget = { depth: number; width: number; simulations: number; timeMs: number; seed: number };
export const levels: Record<string, Omit<Budget, 'seed'>> = {
  easy: { depth: 1, width: 8, simulations: 32, timeMs: 150 },
  normal: { depth: 2, width: 10, simulations: 128, timeMs: 600 },
  hard: { depth: 3, width: 12, simulations: 512, timeMs: 1800 }
};
export type Candidate = { action: number; score: number; visits?: number; probability?: number };
export type Decision = { action: number; algorithm: Algorithm; candidates: Candidate[]; nodes: number; cutoffs: number; depth: number; simulations: number; elapsed: number; budget: Budget; model?: string; reason?: string };
export type Evaluator = (g: Game) => Promise<{ policy: number[]; value: number }>;
export function candidates(g: Game) {
  if (!g.moves.length && !g.board.some(Boolean)) return [Math.floor(g.size / 2) * g.size + Math.floor(g.size / 2)];
  const found = new Set<number>();
  for (let a = 0; a < g.board.length; a++) if (g.board[a]) {
    const r = Math.floor(a / g.size), c = a % g.size;
    for (let y = Math.max(0, r - 2); y <= Math.min(g.size - 1, r + 2); y++)
      for (let x = Math.max(0, c - 2); x <= Math.min(g.size - 1, c + 2); x++) if (!g.board[y * g.size + x]) found.add(y * g.size + x);
  }
  return [...found].sort((a,b) => a-b);
}
// Search constants chosen from scripts/ts/arena.ts matches (13x13, normal budget); see docs/VALIDATION.md.
export const tuning = { mctsExploration: 1.2, rolloutPlies: 6, evalMode: 1, evalTop: 3 };
const fourPatterns = ['11110', '01111', '11011', '10111', '11101'], threePatterns = ['01110', '010110', '011010'], twoPatterns = ['001100', '01010'];
export function threat(g: Game, a: number, p: number) {
  g.board[a] = p;
  if (winningLine(g, a, p).length) { g.board[a] = 0; return 1e8; }
  let score = 0, fours = 0, threes = 0;
  const r = Math.floor(a / g.size), c = a % g.size;
  for (const [dr, dc] of directions) {
    let line = '', own = 0;
    for (let k = -5; k <= 5; k++) {
      const y = r + k * dr, x = c + k * dc;
      if (y < 0 || x < 0 || y >= g.size || x >= g.size) { line += '2'; continue; }
      const v = g.board[y * g.size + x];
      if (v === p) { line += '1'; own++; } else line += v ? '2' : '0';
    }
    // Only windows covering the played stone (index 5) matter.
    const has = (pattern: string) => { for (let start = Math.max(0, 6 - pattern.length); start <= 5; start++) if (line.startsWith(pattern, start)) return true; return false; };
    // Count independent directions, rather than overlapping patterns in one line.
    if (has('011110')) { score += 200000; fours++; }
    else if (fourPatterns.some(has)) { score += 18000; fours++; }
    else if (threePatterns.some(has)) { score += 5000; threes++; }
    else if (twoPatterns.some(has)) score += 250;
    score += own;
  }
  g.board[a] = 0;
  if (fours >= 2 || (fours && threes)) score += 400000;
  if (threes >= 2) score += 40000;
  return score;
}
export function rank(g: Game, width = 12): Candidate[] {
  const scored = candidates(g).map(action => {
    const attack = threat(g, action, g.player), defense = threat(g, action, -g.player);
    const distance = Math.abs(Math.floor(action/g.size)-(g.size-1)/2)+Math.abs(action%g.size-(g.size-1)/2);
    return { action, attack, defense, score: attack + defense * 1.08 - distance * .1 };
  });
  const wins = scored.filter(c => c.attack >= 1e8), blocks = scored.filter(c => c.defense >= 1e8);
  return (wins.length ? wins : blocks.length ? blocks : scored).sort((a,b) => b.score-a.score || a.action-b.action).slice(0, width);
}
function evaluate(g: Game) {
  const own: number[] = [], opp: number[] = [];
  for (const a of candidates(g)) { own.push(threat(g,a,g.player)); opp.push(threat(g,a,-g.player)); }
  const top = (v: number[], k: number) => v.sort((x,y) => y-x).slice(0,k);
  if (tuning.evalMode === 0) return Math.max(0,...own) - 1.08 * Math.max(0,...opp);
  const cap = (x: number) => Math.min(x, 1e6);
  // Side to move wins outright on a four; two separate opposing winning cells cannot both be blocked.
  if (own.some(v => v >= 1e8)) return 1e9;
  const oppWins = opp.filter(v => v >= 1e8).length;
  if (oppWins > 1) return -1e9;
  const k = tuning.evalTop;
  const mine = top(own.map(cap), k).reduce((s,v,i) => s + v / (i + 1), 0);
  const theirs = top(opp.map(v => v >= 1e8 ? 0 : cap(v)), k).reduce((s,v,i) => s + v / (i + 1), 0);
  return mine - 1.08 * theirs - (oppWins ? 5e5 : 0);
}
export async function decide(g: Game, algorithm: Algorithm, budget: Budget, evaluator?: Evaluator, progress?: (d: Decision) => void): Promise<Decision> {
  if (g.done) throw Error('Game finished');
  if (algorithm === 'alphazero' && !evaluator) throw Error('AlphaZero 모델을 먼저 불러오세요');
  const { mctsExploration, rolloutPlies } = tuning;
  const start = performance.now(), deadline = start + budget.timeMs, rng = seeded(budget.seed);
  const result: Decision = { action: -1, algorithm, candidates: [], nodes: 0, cutoffs: 0, depth: 0, simulations: 0, elapsed: 0, budget };
  if (algorithm === 'random') {
    const legal = g.board.flatMap((p,a) => p ? [] : [a]); result.action = legal[Math.floor(rng()*legal.length)]; result.nodes = 1;
  } else if (algorithm === 'heuristic') {
    result.candidates = rank(g, budget.width); result.action = result.candidates[0].action; result.nodes = candidates(g).length;
  } else if (algorithm === 'minimax' || algorithm === 'alphabeta') {
    const cache = new Map<string, number>(); const timeout = Symbol();
    const search = (s: Game, depth: number, alpha: number, beta: number): number => {
      result.nodes++; if (performance.now() >= deadline) throw timeout;
      if (!depth) { const key = s.board.join(',')+':'+s.player; if (!cache.has(key)) cache.set(key,evaluate(s)); return cache.get(key)!; }
      let best = -Infinity;
      for (const c of rank(s, budget.width)) {
        const next = s.clone().play(c.action);
        const value = next.done ? (next.winner ? 1e10+depth : 0) : -search(next,depth-1,-beta,-alpha);
        best = Math.max(best,value);
        if (algorithm === 'alphabeta') { alpha = Math.max(alpha,value); if (alpha >= beta) { result.cutoffs++; break; } }
      }
      return Number.isFinite(best) ? best : 0;
    };
    result.candidates = rank(g,budget.width); result.action = result.candidates[0].action;
    for (let depth = 1; depth <= budget.depth; depth++) {
      try {
        // Alpha-Beta narrows later root moves to the best score so far: they return bounds, so the
        // first strict improvement stays the choice and tied bounds never displace it.
        let rootAlpha = -Infinity, bestAction = -1;
        const scores = result.candidates.map(c => {
          const n = g.clone().play(c.action);
          const score = n.done ? (n.winner ? 1e10+depth : 0) : -search(n,depth-1,-Infinity,algorithm === 'alphabeta' ? -rootAlpha : Infinity);
          if (score > rootAlpha) { rootAlpha = score; bestAction = c.action; }
          return { action: c.action, score };
        });
        scores.sort((a,b) => Number(b.action === bestAction) - Number(a.action === bestAction) || b.score-a.score || a.action-b.action);
        result.candidates = scores; result.action = bestAction; result.depth = depth;
        progress?.({ ...result, elapsed: performance.now()-start });
      } catch (e) { if (e !== timeout) throw e; break; }
    }
  } else {
    // UCT with actual terminal rollouts; PUCT uses the loaded policy/value net.
    // Children keep only (parent, action) until first visited, so expanding a node
    // costs no board clones; AlphaZero nets would otherwise clone up to size² boards per expansion.
    type Node = { g?: Game; parent?: Node; action: number; n: number; w: number; prior: number; children: Node[]; expanded: boolean; toPlay: number };
    const state = (node: Node) => node.g ??= node.parent!.g!.clone().play(node.action);
    const root: Node = { g: g.clone(), action: -1, n: 0, w: 0, prior: 1, children: [], expanded: false, toPlay: g.player };
    const neural = algorithm === 'alphazero';
    const expand = async (node: Node) => {
      const game = state(node); let value = 0, options: Candidate[];
      if (neural) {
        const out = await evaluator!(game); value = out.value;
        options = game.board.flatMap((p,action) => p ? [] : [{action,score: Math.max(0,out.policy[action])}]);
      } else {
        // Heuristic ordering doubles as the search prior (compressed so one huge threat does not starve the rest).
        options = rank(game,budget.width).map(c => ({ ...c, score: Math.log1p(Math.max(0,c.score)) }));
      }
      let total = options.reduce((s,c) => s+c.score,0); if (!(total > 0)) { total=options.length; options.forEach(c => c.score=1); }
      node.children = options.map(c => ({ parent: node, action: c.action, n: 0, w: 0, prior: c.score/total, children: [], expanded: false, toPlay: -node.toPlay }));
      node.expanded=true;
      return value;
    };
    const terminalValue = (game: Game, toPlay: number) => game.winner ? (game.winner===toPlay ? 1 : -1) : 0;
    await expand(root);
    for (let sim = 0; sim < budget.simulations && performance.now() < deadline; sim++) {
      let node=root; const path=[root];
      while (node.expanded && !state(node).done && node.children.length) {
        let best=-Infinity, selected=node.children[0];
        const explore=(neural ? 1.5 : mctsExploration)*Math.sqrt(Math.max(1,node.n));
        for (const child of node.children) {
          const q = child.n ? -child.w/child.n : 0;
          const u = explore*child.prior/(1+child.n);
          if (q+u>best) { best=q+u; selected=child; }
        }
        node=selected; path.push(node);
      }
      const game=state(node); let value: number;
      if (game.done) value=terminalValue(game,node.toPlay);
      else if (neural) value=await expand(node);
      else {
        await expand(node); const rollout=game.clone();
        let plies=0;
        while (!rollout.done && plies++<rolloutPlies && performance.now()<deadline) {
          const opts=rank(rollout,6); const forcing=opts.length===1 || opts[0].score>=1e8;
          rollout.play(opts[forcing ? 0 : Math.floor(rng()*opts.length)].action); result.nodes++;
        }
        value=rollout.done ? terminalValue(rollout,node.toPlay) : Math.tanh(evaluate(rollout)/200000)*(rollout.player===node.toPlay?1:-1);
      }
      for (let i=path.length-1;i>=0;i--) { path[i].n++; path[i].w+=value; value=-value; }
      result.simulations++; result.nodes++;
      if (sim%16===15) progress?.({ ...result, action: root.children.reduce((a,b)=>a.n>b.n?a:b).action, candidates: root.children.map(c=>({action:c.action,score:c.n ? -c.w/c.n : 0,visits:c.n,probability:c.n/Math.max(1,root.n)})), elapsed: performance.now()-start });
    }
    result.candidates=root.children.map(c=>({action:c.action,score:c.n ? -c.w/c.n : 0,visits:c.n,probability:root.n ? c.n/root.n : c.prior})).sort((a,b)=>(b.visits??0)-(a.visits??0)||b.score-a.score);
    result.action=result.candidates[0].action;
    // Tactical guard is explicit: rollout MCTS uses the same win/block ordering.
  }
  result.elapsed=performance.now()-start; return result;
}
