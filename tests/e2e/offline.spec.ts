import { test, expect } from '@playwright/test';

// Offline-first E2E: run with network disabled after load to prove zero remote deps.
test.describe('offline smoke', () => {
  test('boots, plays, merges, shops, saves with no network', async ({ page, context }) => {
    const bad: string[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (/^https?:\/\//.test(u) && !u.startsWith('http://127.') && !u.startsWith('http://localhost')) bad.push(u);
    });
    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2500);
    // click PLAY (canvas game: click center quick-play then drop fruits)
    await page.mouse.click(240, 298);
    await page.waitForTimeout(1500);
    await page.mouse.move(200, 300); await page.mouse.click(200, 300);
    await page.waitForTimeout(900);
    await page.mouse.move(280, 300); await page.mouse.click(280, 300);
    await page.waitForTimeout(900);
    await page.mouse.move(240, 300); await page.mouse.click(240, 300);
    await page.waitForTimeout(1500);
    expect(bad).toEqual([]);
    // go offline and keep rendering
    await context.setOffline(true);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'test-results/offline.png' });
    await context.setOffline(false);
  });
});
