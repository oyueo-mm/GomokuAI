import { test, expect } from '@playwright/test';
import fs from 'node:fs';
test('production bundle plays under GitHub Pages subpath, with local WASM model',async({page})=>{
  const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))failures.push(r.url());});
  await page.goto('./');await expect(page.getByRole('heading',{level:1,name:/오목 AI/})).toBeVisible();await page.getByRole('button',{name:'대국 시작하기'}).click();await page.getByRole('radio',{name:'9 × 9'}).check();await page.getByRole('gridcell',{name:'5행 5열',exact:true}).click();await expect(page.locator('.stone')).toHaveCount(2);
  expect(await page.getByLabel('AI 알고리즘',{exact:true}).locator('option[value=alphazero]').evaluate((o)=>(o as HTMLOptionElement).disabled)).toBe(true);
  if(fs.existsSync('checkpoints/web-smoke/gomoku9-smoke.onnx')){
    await page.getByRole('button',{name:'학습 분석'}).click();await page.locator('input[multiple]').setInputFiles(['checkpoints/web-smoke/gomoku9-smoke.onnx','checkpoints/web-smoke/gomoku9-smoke.json']);await expect(page.getByText(/gomoku9-smoke · 9×9/)).toBeVisible();
    await page.getByRole('button',{name:'대국실'}).click();await page.getByLabel('AI 알고리즘',{exact:true}).selectOption('alphazero');await page.getByText('고급 설정').click();await page.getByLabel('탐색 예산').selectOption('easy');await page.getByRole('button',{name:'계속'}).click();await page.getByRole('gridcell',{name:'4행 4열',exact:true}).click();await expect(page.locator('.stone')).toHaveCount(4);await expect(page.getByText(/AlphaZero · 가지치기/)).toBeVisible();
  }
  expect(failures).toEqual([]);await page.screenshot({path:'test-results/pages-desktop.png',fullPage:true});
});
