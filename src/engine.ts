export type Player = 1 | -1;
export type Rules = { id: 'freestyle'; winLength: number };
export const freestyle: Rules = { id: 'freestyle', winLength: 5 };
export const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
export class Game {
  board: number[]; player: Player = 1; done = false; winner = 0; moves: number[] = []; line: number[] = [];
  constructor(public size = 15, public rules: Rules = freestyle) {
    if (!Number.isInteger(size) || size < 1 || !Number.isInteger(rules.winLength) || rules.winLength < 1) throw Error('Invalid dimensions');
    this.board = Array(size * size).fill(0);
  }
  legal(a: number) { return Number.isInteger(a) && a >= 0 && a < this.board.length && this.board[a] === 0; }
  play(a: number) {
    if (this.done || !this.legal(a)) throw Error('Illegal move');
    this.board[a] = this.player; this.moves.push(a);
    this.line = winningLine(this, a, this.player);
    if (this.line.length) { this.done = true; this.winner = this.player; }
    else if (this.moves.length === this.board.length) this.done = true;
    else this.player = -this.player as Player;
    return this;
  }
  clone() { const g = new Game(this.size, this.rules); g.board = [...this.board]; g.player = this.player; g.done = this.done; g.winner = this.winner; g.moves = [...this.moves]; g.line = [...this.line]; return g; }
  static replay(size: number, moves: number[], rules = freestyle) { const g = new Game(size, rules); for (const a of moves) g.play(a); return g; }
  undo(count = 1) { return Game.replay(this.size, this.moves.slice(0, Math.max(0, this.moves.length - count)), this.rules); }
  record() { return { version: 1, rules: 'freestyle', size: this.size, moves: this.moves }; }
  static load(raw: unknown) {
    const r = raw as ReturnType<Game['record']>;
    if (!r || r.version !== 1 || r.rules !== 'freestyle' || ![9, 13, 15].includes(r.size) || !Array.isArray(r.moves) || r.moves.length > r.size ** 2) throw Error('지원하지 않는 기보');
    return Game.replay(r.size, r.moves);
  }
}
export function winningLine(g: Game, a: number, p: number) {
  const r = Math.floor(a / g.size), c = a % g.size;
  for (const [dr, dc] of directions) {
    const line = [a];
    for (const sign of [-1, 1]) {
      let y = r + sign * dr, x = c + sign * dc;
      while (y >= 0 && y < g.size && x >= 0 && x < g.size && g.board[y * g.size + x] === p) {
        if (sign < 0) line.unshift(y * g.size + x); else line.push(y * g.size + x);
        y += sign * dr; x += sign * dc;
      }
    }
    if (line.length >= g.rules.winLength) return line;
  }
  return [];
}
export function seeded(seed: number) { let s = seed >>> 0; return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
