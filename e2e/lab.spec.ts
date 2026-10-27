import { test, expect } from '@playwright/test';
import fs from 'node:fs';
test('arena alternates colors, records actual budgets and exports results',async({page})=>{
  await page.goto('/#/arena');await expect(page.getByRole('region',{name:'실험 결과'})).toHaveCount(0);
  await page.getByRole('radio',{name:'9 × 9'}).check();
  await page.getByLabel('알고리즘 A',{exact:true}).selectOption('heuristic');await page.getByLabel('알고리즘 B',{exact:true}).selectOption('random');await page.getByLabel('대국 수').selectOption('2');await page.getByLabel('탐색 예산').selectOption('easy');await page.getByRole('button',{name:'비교 실험 시작'}).click();
  await expect(page.getByRole('button',{name:'JSON'})).toBeEnabled();await expect(page.locator('tbody tr')).toHaveCount(2);
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'JSON'}).click();const download=await saved;const result=JSON.parse(fs.readFileSync((await download.path())!,'utf8'));
  expect(result.results.map((r:any)=>r.aBlack)).toEqual([true,false]);expect(result.results[0].budget.timeMs).toBe(150);expect(result.results[0].seed).toBe(42);expect(result.results[0].nodesA).toBeGreaterThan(0);expect(result.results[0].size).toBe(9);
  fs.writeFileSync('test-results/arena-verified.json',JSON.stringify(result,null,2));await page.screenshot({path:'test-results/desktop-arena.png',fullPage:true});
  const csvSaved=page.waitForEvent('download');await page.getByRole('button',{name:'CSV'}).click();expect((await csvSaved).suggestedFilename()).toBe('arena.csv');
});
test('arena can be stopped and does not touch the play room game',async({page})=>{
  await page.goto('/#/play');await page.getByRole('radio',{name:'사람 vs 사람'}).check();await page.getByRole('radio',{name:'9 × 9'}).check();await page.getByRole('gridcell',{name:'5행 5열',exact:true}).click();
  await page.getByRole('button',{name:'AI Arena'}).click();await page.getByRole('radio',{name:'13 × 13'}).check();await page.getByLabel('탐색 예산').selectOption('hard');await page.getByLabel('대국 수').selectOption('20');
  await page.getByRole('button',{name:'비교 실험 시작'}).click();await expect(page.getByRole('button',{name:'실험 중지'})).toBeVisible();await expect(page.locator('.board .stone').first()).toBeVisible();
  await page.getByRole('button',{name:'실험 중지'}).click();await expect(page.getByRole('button',{name:'비교 실험 시작'})).toBeEnabled();
  await page.getByRole('button',{name:'대국실'}).click();await expect(page.locator('.stone')).toHaveCount(1);await expect(page.getByRole('gridcell',{name:'5행 5열 흑 1수'})).toBeVisible();
});
test('training graph uses imported real log only',async({page})=>{
  await page.goto('/#/training');await expect(page.getByText(/log\.csv를 열면/)).toBeVisible();await expect(page.getByRole('img')).toHaveCount(0);
  await page.locator('input[accept=".csv"]').setInputFiles({name:'log.csv',mimeType:'text/csv',buffer:Buffer.from('iteration,policy_loss,value_loss,arena_win_rate\n0,4.53,1.13,0.5\n1,4.46,1.01,0\n')});await expect(page.getByRole('img')).toHaveCount(3);
});
