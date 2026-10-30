import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Manual tooling (QA B14): lists text that is cut off on the phone (line clamp or one-line ellipsis)
 * per page, with the element's class and its full text, so each case can be judged: fine (the
 * full text is one tap away) or a dead end. Usage: `CLIPPED_OUT=../scratch/clipped.json npx playwright test
 * -c playwright.screens.config.ts clipped-text --project=seeded`.
 */
const PAGES = [
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
  '/settings/module',
  '/settings/sicherheit',
];

test('clipped text on the phone', async ({ page }) => {
  await bootDev(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedApp(page, 'medium');
  await page.setViewportSize({ width: 360, height: 800 });
  const out: Record<string, string[]> = {};
  for (const url of PAGES) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForTimeout(1000);
    out[url] = await page.evaluate(() => {
      const seen = new Set<string>();
      for (const el of document.querySelectorAll<HTMLElement>('main *, aside *')) {
        const s = getComputedStyle(el);
        if (s.overflow === 'visible' && s.overflowX === 'visible') continue;
        const cut = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
        if (!cut || !el.textContent?.trim() || el.children.length > 3) continue;
        const cls = String(el.getAttribute('class')).split(' ')[0];
        seen.add(`${cls} | ${el.textContent.trim().slice(0, 70)}`);
      }
      return [...seen];
    });
  }
  const file = process.env.CLIPPED_OUT ?? 'test-results/clipped.json';
  mkdirSync(file.replace(/\/[^/]*$/, '') || '.', { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 2));
});
