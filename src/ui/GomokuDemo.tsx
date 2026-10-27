import { useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_SIZE, nextDemo } from '../demo';
import type { DemoGame } from '../demo';
import { PauseIcon, PlayIcon, RestartIcon } from './controls';

const U = 40, PAD = 26, N = DEMO_SIZE, W = PAD * 2 + (N - 1) * U;
const at = (i: number) => PAD + i * U;
const stars = [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]];
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Self-contained demo for the home page. It owns its own game, never touches the play room's state, and generates each
 * game with one-ply threat scoring only (see demo.ts), so it is a demonstration rather than a search result.
 */
export function GomokuDemo() {
  const seed = useRef(Math.floor(Math.random() * 1e6));
  const [match, setMatch] = useState<DemoGame>(() => nextDemo(seed.current));
  const [playing, setPlaying] = useState(() => !reducedMotion());
  // With reduced motion the demo starts paused on a finished game instead of animating.
  const [shown, setShown] = useState(() => playing ? 0 : match.moves.length);
  const [visible, setVisible] = useState(!document.hidden);
  const root = useRef<HTMLElement>(null), inView = useRef(true);
  const over = shown >= match.moves.length;

  useEffect(() => {
    const sync = () => setVisible(inView.current && !document.hidden);
    document.addEventListener('visibilitychange', sync);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { inView.current = entries[0].isIntersecting; sync(); });
    if (root.current) observer?.observe(root.current);
    return () => { document.removeEventListener('visibilitychange', sync); observer?.disconnect(); };
  }, []);

  // One timer at a time, always cleared on change or unmount.
  useEffect(() => {
    if (!playing || !visible) return;
    const timer = setTimeout(() => {
      if (!over) setShown(shown + 1);
      else { seed.current = match.seed + 1; setMatch(nextDemo(seed.current)); setShown(0); }
    }, over ? 3200 : shown === 0 ? 700 : 620);
    return () => clearTimeout(timer);
  }, [playing, visible, shown, over, match]);

  function restart() { seed.current = match.seed + 1; setMatch(nextDemo(seed.current)); setShown(0); setPlaying(true); }

  const moves = match.moves.slice(0, shown);
  const lastMove = moves.at(-1);
  const winning = useMemo(() => new Set(over ? match.line : []), [over, match]);
  const label = over ? `${match.winner === 1 ? '흑' : '백'} 승리 · ${match.moves.length}수` : shown ? `${shown}수` : '대국 준비';
  const first = match.line[0], end = match.line.at(-1);
  const xy = (a: number) => [at(a % N), at(Math.floor(a / N))];

  return <section ref={root} className="demo" aria-label="오목 자동 대국 시연">
    <div className="demo-board">
      <svg viewBox={`0 0 ${W} ${W}`} role="img" aria-label={`오목 시연 대국 ${label}`}>
        {Array.from({ length: N }, (_, i) => <g key={i} className="demo-grid"><line x1={at(0)} x2={at(N - 1)} y1={at(i)} y2={at(i)}/><line y1={at(0)} y2={at(N - 1)} x1={at(i)} x2={at(i)}/></g>)}
        {stars.map(([r, c]) => <circle key={`${r}-${c}`} cx={at(c)} cy={at(r)} r="3.2" className="demo-star"/>)}
        {moves.map((a, i) => {
          const [x, y] = xy(a), black = i % 2 === 0;
          return <g key={a} className="demo-stone">
            <circle cx={x} cy={y} r="17" className={black ? 'demo-black' : 'demo-white'}/>
            {a === lastMove && !over && <circle cx={x} cy={y} r="4.5" className={black ? 'demo-mark-on-black' : 'demo-mark-on-white'}/>}
            {winning.has(a) && <circle cx={x} cy={y} r="21.5" className="demo-win"/>}
          </g>;
        })}
        {over && first !== undefined && end !== undefined && <line className="demo-win-line" x1={xy(first)[0]} y1={xy(first)[1]} x2={xy(end)[0]} y2={xy(end)[1]}/>}
      </svg>
    </div>
    <div className="demo-bar">
      <div className="demo-actions">
        <button onClick={() => setPlaying(!playing)} aria-pressed={playing} aria-label={playing ? '시연 일시정지' : '시연 재생'}>{playing ? <PauseIcon/> : <PlayIcon/>}<span>{playing ? '일시정지' : '재생'}</span></button>
        <button onClick={restart} aria-label="시연 다시 시작"><RestartIcon/><span>다시 시작</span></button>
      </div>
      <p className="demo-status" aria-live="off"><b>{label}</b><span>시연용 자동 대국</span></p>
    </div>
  </section>;
}
