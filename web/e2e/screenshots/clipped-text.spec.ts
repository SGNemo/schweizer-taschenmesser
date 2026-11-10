import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { bootDev, seedApp } from '../seed/helpers';
import { weekGridTextFaults } from '../seed/weekGridText';

/**
 * Manual tooling (QA B14, identity C18): lists text that is cut off (line clamp or one-line ellipsis) per page
 * and per region – widget bodies, module heads, board/list rows and the rest of the page – on the phone and at
 * 1920 × 1080, with the element's class and its full text, so each case can be judged: fine (the full text is one
 * tap away) or a dead end. The overview shows every widget. The week's hour grid at 1440 × 900 with the agenda open
 * (narrowest day columns, UI audit 2026-11 AE4) is listed too and must be free of cut lines and broken words. Usage: `CLIPPED_OUT=../scratch/clipped.json npx
 * playwright test -c playwright.screens.config.ts clipped-text --project=seeded`.
 */
const WEEK = '/calendar?view=week&date=2026-09-29';
const PAGES = [
  '/',
  '/todos',
  '/planner',
  '/calendar',
  '/calendar?tab=reminders',
  WEEK,
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
const SIZES = [
  { name: 'phone', width: 360, height: 800 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
];
type Region = 'widget' | 'head' | 'row' | 'page';

test('clipped text by region, phone and desktop', async ({ page }) => {
  test.setTimeout(0);
  await bootDev(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedApp(page, 'medium');
  await page.evaluate(() => localStorage.setItem('tm-home-view', 'all'));
  const out: Record<string, Record<string, Partial<Record<Region, string[]>>>> = {};
  const totals: Record<string, Record<Region, number>> = {};
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    out[size.name] = {};
    totals[size.name] = { widget: 0, head: 0, row: 0, page: 0 };
    for (const url of PAGES) {
      await page.goto(url);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(1000);
      const found = await page.evaluate(() => {
        const regions: Record<string, Set<string>> = {};
        for (const el of document.querySelectorAll<HTMLElement>('main *, aside *')) {
          const s = getComputedStyle(el);
          if (s.overflow === 'visible' && s.overflowX === 'visible') continue;
          const cut = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
          if (!cut || !el.textContent?.trim() || el.children.length > 3) continue;
          // Visually hidden text for screen readers (sr-only) is cut on purpose.
          if (el.clientWidth <= 1 || el.clientHeight <= 1) continue;
          const region = el.closest('[data-testid^="widget-"]')
            ? 'widget'
            : el.closest('[data-testid="module-frame"]')
              ? 'head'
              : el.closest('li, [role="row"], [role="listitem"]')
                ? 'row'
                : 'page';
          const cls = String(el.getAttribute('class')).split(' ')[0];
          (regions[region] ??= new Set()).add(`${cls} | ${el.textContent.trim().slice(0, 70)}`);
        }
        return Object.fromEntries(Object.entries(regions).map(([k, v]) => [k, [...v]]));
      });
      out[size.name]![url] = found;
      if (url === WEEK && size.name === 'laptop') {
        await expect(page.getByRole('complementary', { name: 'Agenda' })).toBeVisible();
        expect(await weekGridTextFaults(page), 'week grid at 1440 with the agenda').toEqual([]);
      }
      for (const [k, v] of Object.entries(found)) totals[size.name]![k as Region] += v.length;
    }
  }
  const file = process.env.CLIPPED_OUT ?? 'test-results/clipped.json';
  mkdirSync(file.replace(/\/[^/]*$/, '') || '.', { recursive: true });
  writeFileSync(file, JSON.stringify({ totals, pages: out }, null, 2));
});
