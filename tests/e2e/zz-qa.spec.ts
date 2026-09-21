import { test, expect } from '@playwright/test';

// TEMP visual QA — deleted after review. Uses port 4188 (4173-4175 are taken).
const BASE = 'http://127.0.0.1:4188';
test.describe('visual qa', () => {
  test('menu desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE + '/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/qa-menu-desktop.png' });
  });
  test('menu mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'test-results/qa-menu-mobile.png' });
  });
  test('gameplay desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE + '/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);
    // canvas is 480x800 FIT in 1280x800 -> scale 1.0, offset x=(1280-480)/2=400
    // click PLAY on the first mode card (Classic)
    await page.mouse.click(400 + 396, 508);
    await page.waitForTimeout(2000);
    for (const x of [200, 280, 240, 180, 300, 240]) {
      await page.mouse.move(400 + x, 300);
      await page.mouse.click(400 + x, 300);
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/qa-game-desktop.png' });
    // keyboard: drop via space, powerup key, pause via button click
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
    await page.mouse.click(400 + 454, 26);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/qa-pause-desktop.png' });
    await page.keyboard.press('p');
    await page.waitForTimeout(400);
  });
});
