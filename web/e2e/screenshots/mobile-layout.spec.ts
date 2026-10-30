import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Manual tooling (QA package P2, mobile layout): one screenshot per page and width (320 / 412 / 640 /
 * 1280 px) on the seeded Dev-Preview build, plus a report of horizontal overflow and touch targets
 * under 44 px. Run before and after a layout change and compare the folders:
 * `MOBILE_DIR=test-results/mobile/before npx playwright test -c playwright.screens.config.ts mobile-layout --project=seeded`.
 */
const OUT = process.env.MOBILE_DIR ?? 'test-results/mobile';
const WIDTHS = [
  { width: 320, height: 640 },
  { width: 412, height: 915 },
  { width: 640, height: 900 },
  { width: 1280, height: 800 },
];
const PAGES: [string, string][] = [
  ['home', '/'],
  ['todos', '/todos'],
  ['calendar', '/calendar'],
  ['reminders', '/calendar?tab=reminders'],
  ['lists', '/lists'],
  ['invoices', '/invoices'],
  ['notes', '/notes'],
  ['vault', '/vault'],
  ['settings', '/settings'],
  ['settings-benachrichtigungen', '/settings/benachrichtigungen'],
];

async function measure(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const small = [...document.querySelectorAll('button, a[href], [role="button"]')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44))
      .map(
        ({ el, r }) =>
          `${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`,
      );
    return { overflowX: doc.scrollWidth - doc.clientWidth, small };
  });
}

test('mobile layout tour', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = {};
  for (const vp of WIDTHS) {
    const context = await browser.newContext({
      viewport: vp,
      isMobile: vp.width < 900,
      hasTouch: vp.width < 900,
    });
    const page = await context.newPage();
    await bootDev(page);
    // Seed on a desktop viewport: at 320 px the bottom bar can sit over the seed button.
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedApp(page, 'medium');
    await page.setViewportSize(vp);
    for (const [name, path] of PAGES) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${name}-${vp.width}.png` });
      report[`${name}-${vp.width}`] = await measure(page);
    }
    await context.close();
  }
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
});

test('welcome card on an empty app and a running focus round', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  for (const vp of WIDTHS.slice(0, 3)) {
    const context = await browser.newContext({
      viewport: vp,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await bootDev(page);
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/welcome-${vp.width}.png` });
    await context.close();
  }
});
