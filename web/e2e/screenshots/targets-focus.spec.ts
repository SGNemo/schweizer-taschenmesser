import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';

/**
 * Manual tooling (focus audit 2, package 3): lists the interactive elements under 44 px on the
 * phone, per page, without the controls that look smaller and keep a 44 px hit area on purpose
 * (icon/small buttons, switch tracks, chips, segment strips: ui/*.module.css).
 * Usage: `TARGETS_OUT=../docs/product/focus/img/targets-before.json npx playwright test
 * -c playwright.screens.config.ts targets-focus --project=seeded`.
 */
const PAGES = [
  '/',
  '/todos',
  '/calendar',
  '/finance',
  '/notes',
  '/lists',
  '/pantry',
  '/people',
  '/bookmarks',
  '/settings/darstellung',
];

test('targets under 44 px on the phone', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await bootDev(page);
  await seedApp(page, 'medium');
  const out: Record<string, string[]> = {};
  for (const url of PAGES) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForTimeout(1200);
    out[url] = await page.evaluate(() =>
      [...document.querySelectorAll('button, a[href], [role="button"], [role="menuitem"]')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(
          ({ el, r }) =>
            r.width > 0 &&
            r.height > 0 &&
            (r.height < 44 || r.width < 44) &&
            !el.matches(
              '[class*="_icon_"], [class*="_sm_"], [class*="_track_"], [class*="_chip_"], [class*="_dayNum_"], [class*="_segment_"] button',
            ),
        )
        .map(
          ({ el, r }) =>
            `${el.tagName.toLowerCase()}.${String(el.getAttribute('class')).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`,
        ),
    );
  }
  const file = process.env.TARGETS_OUT ?? 'test-results/targets.json';
  mkdirSync(file.replace(/[^/]*$/, '') || '.', { recursive: true });
  writeFileSync(file, JSON.stringify(out, null, 1));
});
