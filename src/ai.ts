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
export function threat(g: Game, a: number, p: number) {
  g.board[a] = p;
  if (winningLine(g, a, p).length) { g.board[a] = 0; return 1e8; }
  let score = 0, fours = 0, threes = 0;
  const r = Math.floor(a / g.size), c = a % g.size;
  for (const [dr, dc] of directions) {
    let line = '';
    for (let k = -5; k <= 5; k++) { const y = r + k * dr, x = c + k * dc; line += y < 0 || x < 0 || y >= g.size || x >= g.size ? '2' : g.board[y * g.size + x] === p ? '1' : g.board[y * g.size + x] ? '2' : '0'; }
    const has = (pattern:string) => {for(let start=0;start+pattern.length<=line.length;start++)if(start<=5&&start+pattern.length>5&&line.slice(start,start+pattern.length)===pattern)return true;return false;};
    // Count independent directions, rather than overlapping patterns in one line.
    if (has('011110')) { score += 200000; fours++; }
    else if (['11110','01111','11011','10111','11101'].some(has)) { score += 18000; fours++; }
    else if (['01110','010110','011010'].some(has)) { score += 5000; threes++; }
    else if (['001100','01010'].some(has)) score += 250;
    score += [...line].filter(v => v === '1').length;
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
  const opts = candidates(g); let own = 0, opp = 0;
  for (const a of opts) { own = Math.max(own, threat(g,a,g.player)); opp = Math.max(opp,threat(g,a,-g.player)); }
  return own - 1.08 * opp;
}
export async function decide(g: Game, algorithm: Algorithm, budget: Budget, evaluator?: Evaluator, progress?: (d: Decision) => void): Promise<Decision> {
  if (g.done) throw Error('Game finished');
  if (algorithm === 'alphazero' && !evaluator) throw Error('AlphaZero 모델을 먼저 불러오세요');
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
        const scores = result.candidates.map(c => { const n = g.clone().play(c.action); return { action: c.action, score: n.done ? (n.winner ? 1e10+depth : 0) : -search(n,depth-1,-Infinity,Infinity) }; });
        scores.sort((a,b) => b.score-a.score || a.action-b.action); result.candidates = scores; result.action = scores[0].action; result.depth = depth;
        progress?.({ ...result, elapsed: performance.now()-start });
      } catch (e) { if (e !== timeout) throw e; break; }
    }
  } else {
    // UCT with actual terminal rollouts; PUCT uses the loaded policy/value net.
    type Node = { g: Game; action: number; n: number; w: number; prior: number; children: Node[]; expanded: boolean; toPlay: number };
    const make = (state: Game, action=-1, prior=1, toPlay:number=state.player): Node => ({g:state,action,n:0,w:0,prior,children:[],expanded:false,toPlay});
    const root = make(g.clone()); const neural = algorithm === 'alphazero';
    const expand = async (node: Node) => {
      let value = 0, options: Candidate[];
      if (neural) {
        const out = await evaluator!(node.g); value = out.value;
        options = node.g.board.flatMap((p,action) => p ? [] : [{action,score: Math.max(0,out.policy[action])}]);
      } else options = rank(node.g,budget.width).map(c => ({ ...c, score: 1 }));
      let total = options.reduce((s,c) => s+c.score,0); if (!(total > 0)) { total=options.length; options.forEach(c => c.score=1); }
      node.children = options.map(c => make(node.g.clone().play(c.action),c.action,c.score/total,-node.toPlay)); node.expanded=true;
      return value;
    };
    await expand(root);
    for (let sim = 0; sim < budget.simulations && performance.now() < deadline; sim++) {
      let node=root; const path=[root];
      while (node.expanded && !node.g.done && node.children.length) {
        let best=-Infinity, selected=node.children[0];
        for (const child of node.children) {
          const q = child.n ? -child.w/child.n : 0;
          const u = neural ? 1.5*child.prior*Math.sqrt(Math.max(1,node.n))/(1+child.n) : child.n ? Math.sqrt(2*Math.log(node.n+1)/child.n) : 1e9+rng();
          if (q+u>best) { best=q+u; selected=child; }
        }
        node=selected; path.push(node);
      }
      let value: number;
      if (node.g.done) value=node.g.winner ? (node.g.winner===node.toPlay ? 1 : -1) : 0;
      else if (neural) value=await expand(node);
      else {
        await expand(node); const rollout=node.g.clone();
        let plies=0;
        while (!rollout.done && plies++<12 && performance.now()<deadline) {
          const opts=rank(rollout,6); const forcing=opts.length===1 || opts[0].score>=1e8;
          rollout.play(opts[forcing ? 0 : Math.floor(rng()*opts.length)].action); result.nodes++;
        }
        value=rollout.done ? (rollout.winner ? (rollout.winner===node.toPlay ? 1 : -1) : 0) : Math.tanh(evaluate(rollout)/200000)*(rollout.player===node.toPlay?1:-1);
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
