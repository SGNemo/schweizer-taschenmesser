import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Manual tooling: visits every settings category and the main pages at 360 px and reports horizontal
 * overflow (page wider than the screen) and the elements that stick out. Usage:
 * `OVERFLOW_OUT=/tmp/overflow.json npx playwright test -c playwright.screens.config.ts overflow-finder --project=seeded`.
 */
const EXTRA = [
  '/',
  '/todos',
  '/calendar',
  '/calendar?tab=reminders',
  '/finance',
  '/invoices',
  '/subscriptions',
  '/budgets',
  '/notes',
  '/lists',
  '/pantry',
  '/people',
  '/bookmarks',
  '/vault',
  '/library',
  '/tools',
];

test('horizontal overflow at 360 px', async ({ page }) => {
  await bootDev(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedApp(page, 'medium');
  await page.goto('/settings/allgemein');
  await expect(page.locator('main h1')).toBeVisible();
  await page.locator('a[href^="/settings/"]').first().waitFor();
  const cats = await page
    .locator('a[href^="/settings/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  await page.setViewportSize({ width: 360, height: 800 });
  const out: Record<string, unknown> = {};
  for (const url of [...cats, ...EXTRA]) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForTimeout(800);
    out[url] = await page.evaluate(() => {
      const doc = document.documentElement;
      const wide = doc.scrollWidth - doc.clientWidth;
      const out = [...document.querySelectorAll<HTMLElement>('main *')]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && e.offsetParent !== null)
        .slice(0, 6)
        .map(
          (e) =>
            `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} right=${Math.round(e.getBoundingClientRect().right)}`,
        );
      return { wide, out };
    });
  }
  const file = process.env.OVERFLOW_OUT ?? 'test-results/overflow.json';
  mkdirSync(file.replace(/\/[^/]*$/, '') || '.', { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2));
});
