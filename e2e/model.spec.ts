import { test, expect } from '@playwright/test';
import fs from 'node:fs';
const root='checkpoints/web-smoke/gomoku9-smoke';
test('real exported model: browser WASM parity, UI load, AlphaZero move',async({page})=>{
  test.skip(!fs.existsSync(root+'.onnx'),'Run python -m scripts.train_smoke_web and scripts.export_model first');
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByLabel('보드 크기').selectOption('9');
  const fixture=JSON.parse(fs.readFileSync(root+'.parity.json','utf8'));
  const actual=await page.evaluate(async(fixture)=>{
    const {loadModel}=await import('/src/neural.ts');const {Game}=await import('/src/engine.ts');
    const meta=await fetch('/checkpoints/web-smoke/gomoku9-smoke.json').then(r=>r.json());
    const bytes=await fetch('/checkpoints/web-smoke/gomoku9-smoke.onnx').then(r=>r.arrayBuffer());
    const evaluator=await loadModel(bytes,meta);const g=new Game(9);g.player=fixture.states[162]===1?1:-1;g.board=Array.from({length:81},(_,a)=>fixture.states[a]?g.player:fixture.states[81+a]?-g.player:0);
    return {out:await evaluator(g),board:g.board};
  },fixture);
  const max=Math.max(...fixture.logits),probs=fixture.logits.map((v:number,a:number)=>actual.board[a]?0:Math.exp(v-max)),sum=probs.reduce((a:number,b:number)=>a+b,0);
  expect(Math.max(...actual.out.policy.map((p:number,a:number)=>Math.abs(p-probs[a]/sum)))).toBeLessThan(1e-5);expect(Math.abs(actual.out.value-fixture.value)).toBeLessThan(1e-5);
  await page.getByRole('button',{name:'학습 분석'}).click();await page.locator('input[multiple]').setInputFiles([root+'.onnx',root+'.json']);await expect(page.getByText(/gomoku9-smoke · 9×9/)).toBeVisible();
  await page.getByRole('button',{name:'대국실'}).click();await page.getByLabel('AI 알고리즘',{exact:true}).selectOption('alphazero');await page.getByLabel('탐색 예산').selectOption('easy');await page.getByRole('button',{name:'계속',exact:false}).click().catch(()=>{});
  await page.getByRole('gridcell',{name:'5행 5열',exact:true}).click();await expect(page.locator('.stone')).toHaveCount(2);await expect(page.getByText(/AlphaZero · 가지치기/)).toBeVisible();expect(errors).toEqual([]);
});
