import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
test('human game win, undo, save/load and restart',async({page})=>{
  await page.goto('/#/play');await page.getByRole('radio',{name:'사람 vs 사람'}).check();await page.getByRole('radio',{name:'9 × 9'}).check();
  for(const [r,c] of [[1,1],[2,1],[1,2],[2,2],[1,3],[2,3],[1,4],[2,4],[1,5]])await page.getByRole('gridcell',{name:`${r}행 ${c}열`,exact:true}).click();
  await expect(page.getByText('흑 승리',{exact:true})).toBeVisible();await expect(page.locator('.winning')).toHaveCount(5);
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'기보 저장'}).click();const record=await saved;expect(record.suggestedFilename()).toBe('gomoku-record.json');
  await page.getByRole('button',{name:'무르기'}).click();await expect(page.locator('.stone')).toHaveCount(8);
  await page.getByRole('button',{name:'새 대국'}).click();await expect(page.locator('.stone')).toHaveCount(0);
  await page.locator('input[type=file]').first().setInputFiles({name:'record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,rules:'freestyle',size:9,moves:[40,41]}))});await expect(page.locator('.stone')).toHaveCount(2);
});
test('worker responds, cancellation does not apply stale move',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#/play');
  await page.getByRole('gridcell',{name:'8행 8열',exact:true}).click();await expect(page.locator('.stone')).toHaveCount(2);await expect(page.getByText('Heuristic · 가지치기 0회')).toBeVisible();
  await page.getByRole('radio',{name:'AI vs AI'}).check();await page.getByRole('button',{name:'일시정지'}).click();await page.getByRole('button',{name:'새 대국'}).click();await page.getByRole('button',{name:'일시정지'}).click();
  const count=await page.locator('.stone').count();await page.waitForTimeout(500);await expect(page.locator('.stone')).toHaveCount(count);expect(errors).toEqual([]);
});
test('mobile board is playable without horizontal overflow',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();
  await page.goto('/#/play');await page.getByRole('radio',{name:'사람 vs 사람'}).check();await page.getByRole('gridcell',{name:'8행 8열',exact:true}).tap();await expect(page.locator('.stone')).toHaveCount(1);expect(await overflow(page)).toBe(false);await page.screenshot({path:'test-results/mobile.png',fullPage:true});await context.close();
});
test('15x15 board on a 360px phone: every cell is tappable and nothing overflows',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:360,height:740},hasTouch:true,isMobile:true});const page=await context.newPage();
  await page.goto('/#/play');await page.getByRole('radio',{name:'사람 vs 사람'}).check();
  const cell=page.getByRole('gridcell',{name:'15행 15열',exact:true});const box=(await cell.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(18);expect(box.x+box.width).toBeLessThanOrEqual(360);
  await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await expect(page.getByRole('gridcell',{name:'15행 15열 흑 1수'})).toBeVisible();
  expect(await overflow(page)).toBe(false);
  await context.close();
});
test('flat monochrome design; candidate heatmap is opt-in',async({page})=>{
  await page.goto('/#/play');await page.getByRole('radio',{name:'9 × 9'}).check();
  expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgb(250, 250, 250)');
  await page.getByRole('gridcell',{name:'5행 5열',exact:true}).click();await expect(page.locator('.stone')).toHaveCount(2);await expect(page.getByText('Heuristic · 가지치기 0회')).toBeVisible();
  const heatbox=page.getByRole('checkbox',{name:'후보 히트맵'});await expect(heatbox).not.toBeChecked();await expect(page.locator('.heat')).toHaveCount(0);
  await heatbox.check();await expect(page.locator('.heat').first()).toBeVisible();await heatbox.uncheck();await expect(page.locator('.heat')).toHaveCount(0);
  // Stones and board: solid fills, no gradients or drop shadows; no chromatic colors anywhere (the zinc text gray #71717a is within a few levels of neutral).
  const flat=await page.evaluate(()=>[...document.querySelectorAll('.stone,.board,.card,button')].every(e=>{const s=getComputedStyle(e);return s.boxShadow==='none'&&!s.backgroundImage.includes('gradient');}));expect(flat).toBe(true);
  const chromatic=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor,s.borderTopColor].some(c=>{const m=c.match(/\d+(\.\d+)?/g);if(!m||(m[3]!==undefined&&+m[3]===0))return false;const [r,g,b]=m.map(Number);return Math.max(r,g,b)-Math.min(r,g,b)>12;});}).map(e=>e.className));expect(chromatic).toEqual([]);
});
test('mobile layout: no horizontal overflow on every page and controls are touch-sized',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:360,height:740},hasTouch:true,isMobile:true});const page=await context.newPage();await page.goto('/');
  for(const name of ['대국실','AI Arena','학습 분석','홈']){
    await page.getByRole('button',{name:'메뉴 열기'}).click();await page.getByRole('navigation',{name:'주 메뉴'}).getByRole('button',{name}).click();
    await expect(page.locator('.mobile-open')).toHaveCount(0);expect(await overflow(page)).toBe(false);
    const small=await page.evaluate(()=>[...document.querySelectorAll('.toolbar button,.toolbar .file-button,select,.mobile-bar button')].filter(e=>e.getBoundingClientRect().height<38).map(e=>e.textContent));expect(small).toEqual([]);
  }
  await context.close();
});
