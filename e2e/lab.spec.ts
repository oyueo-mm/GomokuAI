import { test, expect } from '@playwright/test';
import fs from 'node:fs';
test('arena alternates colors, records actual budgets and exports results',async({page})=>{
  await page.goto('/');await page.getByLabel('보드 크기').selectOption('9');await page.getByRole('button',{name:'AI Arena'}).click();
  await page.getByLabel('알고리즘 A',{exact:true}).selectOption('heuristic');await page.getByLabel('알고리즘 B',{exact:true}).selectOption('random');await page.getByLabel('대국 수').selectOption('2');await page.getByLabel('탐색 예산').selectOption('easy');await page.getByRole('button',{name:'비교 실험 시작'}).click();
  await expect(page.getByRole('button',{name:'JSON'})).toBeEnabled();await expect(page.locator('tbody tr')).toHaveCount(2);
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'JSON'}).click();const download=await saved;const result=JSON.parse(fs.readFileSync((await download.path())!,'utf8'));
  expect(result.results.map((r:any)=>r.aBlack)).toEqual([true,false]);expect(result.results[0].budget.timeMs).toBe(150);expect(result.results[0].seed).toBe(42);expect(result.results[0].nodesA).toBeGreaterThan(0);
  fs.writeFileSync('test-results/arena-verified.json',JSON.stringify(result,null,2));await page.screenshot({path:'test-results/desktop-arena.png',fullPage:true});
  const csvSaved=page.waitForEvent('download');await page.getByRole('button',{name:'CSV'}).click();expect((await csvSaved).suggestedFilename()).toBe('arena.csv');
});
test('training graph uses imported real log only',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'학습 분석'}).click();await expect(page.getByText(/가상 학습 데이터는 없습니다/)).toBeVisible();await page.locator('input[accept=".csv"]').setInputFiles({name:'log.csv',mimeType:'text/csv',buffer:Buffer.from('iteration,policy_loss,value_loss,arena_win_rate\n0,4.53,1.13,0.5\n1,4.46,1.01,0\n')});await expect(page.getByRole('img')).toHaveCount(3);
});
