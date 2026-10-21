import { expect, it } from 'vitest';
import { encodeCsv } from '../experiment';
it('exports RFC4180 quote escaping for nested budgets and model names',()=>{
  expect(encodeCsv([{a:'a,"b"',budget:{depth:2},n:5}])).toBe('a,budget,n\r\n"a,""b""","{""depth"":2}",5');
});
