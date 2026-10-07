import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Screenshots of the tools sheet and the phone "Mehr" sheet (manual tooling, see
 * playwright.screens.config.ts). Invented data only. Output: SCREENS_DIR (default
 * test-results/screens/tools).
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/tools';
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080, mobile: false },
  { name: '412x915', width: 412, height: 915, mobile: true },
];

for (const vp of VIEWPORTS) {
  test(`tools sheet ${vp.name}`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    if (vp.mobile) {
      await page.getByRole('button', { name: 'Mehr', exact: true }).click();
      await page.screenshot({ path: `${OUT}/more-${vp.name}.png` });
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: `${OUT}/tools-${vp.name}.png` });
    await page.getByRole('dialog').getByRole('button', { name: 'Rechner' }).click();
    await page.screenshot({ path: `${OUT}/calc-${vp.name}.png` });
    await context.close();
  });
}
