import { test, expect } from '@playwright/test';
test('human game win, undo, save/load and restart',async({page})=>{
  await page.goto('/');await page.getByLabel('대국 방식').selectOption('human-human');await page.getByLabel('보드 크기').selectOption('9');
  for(const [r,c] of [[1,1],[2,1],[1,2],[2,2],[1,3],[2,3],[1,4],[2,4],[1,5]])await page.getByRole('gridcell',{name:`${r}행 ${c}열`,exact:true}).click();
  await expect(page.getByText('흑 승리',{exact:true})).toBeVisible();await expect(page.locator('.winning')).toHaveCount(5);
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'기보 저장'}).click();const record=await saved;expect(record.suggestedFilename()).toBe('gomoku-record.json');
  await page.getByRole('button',{name:'무르기'}).click();await expect(page.locator('.stone')).toHaveCount(8);
  await page.getByRole('button',{name:'새 대국'}).click();await expect(page.locator('.stone')).toHaveCount(0);
  await page.locator('input[type=file]').first().setInputFiles({name:'record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,rules:'freestyle',size:9,moves:[40,41]}))});await expect(page.locator('.stone')).toHaveCount(2);
});
test('worker responds, cancellation does not apply stale move',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
  await page.getByRole('gridcell',{name:'8행 8열',exact:true}).click();await expect(page.locator('.stone')).toHaveCount(2);await expect(page.getByText('Heuristic · 가지치기 0회')).toBeVisible();
  await page.getByLabel('대국 방식').selectOption('ai-ai');await page.getByRole('button',{name:'일시정지'}).click();await page.getByRole('button',{name:'새 대국'}).click();await page.getByRole('button',{name:'일시정지'}).click();
  const count=await page.locator('.stone').count();await page.waitForTimeout(500);await expect(page.locator('.stone')).toHaveCount(count);expect(errors).toEqual([]);
});
test('mobile board is playable without horizontal overflow',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
  await page.goto('http://127.0.0.1:5173/');await page.getByLabel('대국 방식').selectOption('human-human');await page.getByRole('gridcell',{name:'8행 8열',exact:true}).tap();await expect(page.locator('.stone')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/mobile.png',fullPage:true});await context.close();
});
test('15x15 board on a 360px phone: every cell is tappable and nothing overflows',async({browser})=>{
  const context=await browser.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true});const page=await context.newPage();
  await page.goto('http://127.0.0.1:5173/');await page.getByLabel('대국 방식').selectOption('human-human');
  const cell=page.getByRole('gridcell',{name:'15행 15열',exact:true});const box=(await cell.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(18);expect(box.x+box.width).toBeLessThanOrEqual(360);
  await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await expect(page.getByRole('gridcell',{name:'15행 15열 흑 1수'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await context.close();
});
