export function encodeCsv(rows:Record<string,unknown>[]) {
  if(!rows.length)return '';
  const keys=Object.keys(rows[0]);
  const cell=(value:unknown)=>{const s=typeof value==='object'?JSON.stringify(value):String(value??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return [keys.map(cell).join(','),...rows.map(row=>keys.map(key=>cell(row[key])).join(','))].join('\r\n');
}
import { seeded } from './engine';
/** Two distinct stones near the center, so paired games differ even for deterministic algorithms. */
export function arenaOpening(size: number, seed: number) {
  const rng = seeded(seed), center = Math.floor(size / 2), span = Math.min(2, center), out: number[] = [];
  while (out.length < 2) {
    const a = (center + Math.floor(rng() * (2 * span + 1)) - span) * size + center + Math.floor(rng() * (2 * span + 1)) - span;
    if (!out.includes(a)) out.push(a);
  }
  return out;
}
