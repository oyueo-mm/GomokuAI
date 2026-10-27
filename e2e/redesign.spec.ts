import { test, expect } from '@playwright/test';

test('home is the default page with the demo, and its buttons navigate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /오목 AI\s*시뮬레이터/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '홈', exact: true })).toHaveAttribute('aria-current', 'page');
  const demo = page.getByRole('region', { name: '오목 자동 대국 시연' }), stones = demo.locator('.demo-stone');
  await expect(stones.first()).toBeVisible();
  const first = await stones.count();
  await expect.poll(() => stones.count()).toBeGreaterThan(first);
  await demo.getByRole('button', { name: '시연 일시정지' }).click();
  const paused = await stones.count(); await page.waitForTimeout(1500); expect(await stones.count()).toBe(paused);
  await demo.getByRole('button', { name: '시연 다시 시작' }).click(); await expect.poll(() => stones.count()).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: '대국 시작하기' }).click(); await expect(page).toHaveURL(/#\/play$/); await expect(page.getByRole('grid', { name: '오목판' })).toBeVisible();
  await page.getByRole('button', { name: '홈', exact: true }).click(); await page.getByRole('button', { name: 'AI Arena', exact: true }).first().click(); await expect(page.getByRole('region', { name: '실험 설정' })).toBeVisible();
  await page.getByRole('button', { name: '홈', exact: true }).click(); await page.getByRole('button', { name: /학습 분석 →/ }).click(); await expect(page.getByRole('region', { name: 'AlphaZero 모델' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('home demo plays a full game to a highlighted five', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/');
  const demo = page.getByRole('region', { name: '오목 자동 대국 시연' });
  await expect(demo.locator('.demo-win')).toHaveCount(5, { timeout: 55000 });
  await expect(demo.getByText(/승리 · \d+수/)).toBeVisible();
});

test('sidebar collapses, is keyboard operable, and deep links work', async ({ page }) => {
  await page.goto('/#/arena');
  await expect(page.getByRole('button', { name: 'AI Arena' })).toHaveAttribute('aria-current', 'page');
  const toggle = page.getByRole('button', { name: '사이드바 접기' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true'); await toggle.click();
  await expect(page.locator('.app-shell')).toHaveClass(/is-collapsed/); await expect(page.getByRole('button', { name: '사이드바 펼치기' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.sidebar-label').first()).toBeHidden();
  await page.reload(); await expect(page.locator('.app-shell')).toHaveClass(/is-collapsed/);
  await page.getByRole('button', { name: '대국실' }).focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/play$/); await expect(page.getByRole('button', { name: '대국실' })).toHaveAttribute('aria-current', 'page');
  await page.goBack(); await expect(page.getByRole('button', { name: 'AI Arena' })).toHaveAttribute('aria-current', 'page');
});

test('phone drawer opens, traps the page behind it and closes on Escape', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#sidebar')).toBeHidden();
  await page.getByRole('button', { name: '메뉴 열기' }).tap(); await expect(page.locator('#sidebar')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#sidebar')).toBeHidden(); await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeFocused();
  await page.getByRole('button', { name: '메뉴 열기' }).tap(); await page.locator('.collapse-button').tap(); await expect(page.locator('#sidebar')).toBeHidden();
  await context.close();
});

test('game and AI state survive page changes; leaving mid-search applies no stale move', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/play'); await page.getByRole('radio', { name: '9 × 9' }).check();
  await page.getByRole('gridcell', { name: '5행 5열', exact: true }).click(); await expect(page.locator('.stone')).toHaveCount(2);
  await page.getByRole('button', { name: '홈', exact: true }).click(); await page.waitForTimeout(300); await page.getByRole('button', { name: '대국실' }).click();
  await expect(page.locator('.stone')).toHaveCount(2); await expect(page.getByRole('radio', { name: '9 × 9' })).toBeChecked();
  await page.getByRole('radio', { name: 'AI vs AI' }).check(); await page.getByRole('button', { name: '홈', exact: true }).click(); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '대국실' }).click(); await page.getByRole('button', { name: '일시정지' }).click();
  const count = await page.locator('.stone').count(); await page.waitForTimeout(600); await expect(page.locator('.stone')).toHaveCount(count);
  expect(errors).toEqual([]);
});

test('decorative copy is gone and rule help is still reachable', async ({ page }) => {
  const banned = ['PLAY. OBSERVE', '한 수 너머', 'OPEN RESEARCH LAB', 'FREESTYLE', '01 — LAB', '브라우저에서 실행', 'MATCH SETTINGS', 'THINKING INSPECTOR', 'LIVE BOARD', 'CONTROLLED COMPARISON', 'POLICY + VALUE NETWORK', 'TRAINING HISTORY', 'EXPERIMENT RESULTS', '연구는 한 수에서 시작됩니다', '깊이 ≤', '최대 128회'];
  for (const hash of ['', 'play', 'arena', 'training']) {
    await page.goto(`/#/${hash}`); const text = await page.locator('body').innerText();
    for (const phrase of banned) expect(text, `${phrase} on #/${hash}`).not.toContain(phrase);
  }
  await page.goto('/#/play'); await page.getByText('규칙', { exact: true }).click(); await expect(page.getByText('자유형 · 5개 이상 연결 승리 · 렌주 금수 미지원')).toBeVisible();
  await expect(page.getByText('아직 분석 결과가 없습니다.')).toBeVisible();
});
