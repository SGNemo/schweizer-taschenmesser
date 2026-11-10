import { expect } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, startSeeded } from './guards';

/**
 * A desktop window that can be touched (UI audit 2026-11, package 0a-1b; rule 5 of the 4.0 plan): a touch laptop
 * reports `pointer: fine` and `any-pointer: coarse`, so the compact rows meant for mouse-only screens must not
 * apply there. Every link and button of the navigation and of the page has a hit area of at least 44 × 44 px.
 * The month view of the calendar is left out: its entry lines are a known case (`a11y.seed.spec.ts`, package 0b-4).
 */
test.use({
  viewport: DESKTOP,
  hasTouch: true,
  seeded: { scale: 'small', desktop: true, preview: true },
});

test('the window reports a coarse pointer next to the fine one', async ({ page }) => {
  await startSeeded(page);
  await openPage(page, '/todos');
  expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
});

test('links and buttons of navigation and page are at least 44 px on a touch desktop', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await startSeeded(page);
  for (const path of [
    '/',
    '/library',
    '/settings',
    '/todos',
    '/finance',
    '/invoices',
    '/vault',
    '/pantry',
    '/notes',
  ]) {
    await openPage(page, path);
    const small = await page.evaluate(() => {
      const visible = (e: Element) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
      };
      return [
        ...document.querySelectorAll<HTMLElement>(
          'nav a[href], nav button, main [data-row], main button, main a[href]',
        ),
      ]
        .filter(visible)
        .filter((e) => {
          const r = e.getBoundingClientRect();
          // A small mark may carry a larger hit area as an absolutely placed ::after (ui/Button, chips).
          const after = getComputedStyle(e, '::after');
          const extended = after.content !== 'none' && after.position === 'absolute';
          // Links inside running text are text, not targets of their own (WCAG 2.5.8, inline exception).
          const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline';
          return !extended && !inline && (r.height < 44 || r.width < 44);
        })
        .map((e) => {
          const r = e.getBoundingClientRect();
          const name = (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24);
          return `${Math.round(r.width)}×${Math.round(r.height)} ${e.tagName.toLowerCase()} "${name}"`;
        });
    });
    expect.soft(small, `${path}: hit areas under 44 px`).toEqual([]);
  }
});
