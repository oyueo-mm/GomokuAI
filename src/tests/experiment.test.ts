import { expect, it } from 'vitest';
import { encodeCsv, arenaOpening } from '../experiment';
it('exports RFC4180 quote escaping for nested budgets and model names',()=>{
  expect(encodeCsv([{a:'a,"b"',budget:{depth:2},n:5}])).toBe('a,budget,n\r\n"a,""b""","{""depth"":2}",5');
});
it('arena openings are seeded, legal, central and vary between pairs',()=>{
  for(const size of [9,13,15]){const a=arenaOpening(size,42);expect(a).toEqual(arenaOpening(size,42));expect(new Set(a).size).toBe(2);for(const m of a)expect(m).toBeGreaterThanOrEqual(0);}
  expect(new Set([42,43,44,45,46,47].map(s=>arenaOpening(9,s).join())).size).toBeGreaterThan(3);
});
