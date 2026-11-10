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

/**
 * Links and buttons whose hit area is under 44 × 44 px. A small mark may carry a larger area as an absolutely placed
 * ::after (ui/Button, chips): its box follows from its insets against the element's own box and counts only when it
 * measures 44 px both ways. Half a pixel of rounding is allowed.
 */
function smallTargets(): string[] {
  const MIN = 43.5;
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
      if (r.width >= MIN && r.height >= MIN) return false;
      const after = getComputedStyle(e, '::after');
      const inset = ['left', 'right', 'top', 'bottom'].map((side) =>
        parseFloat(after.getPropertyValue(side)),
      );
      const [left, right, top, bottom] = inset as [number, number, number, number];
      const extended =
        after.content !== 'none' &&
        after.position === 'absolute' &&
        inset.every(Number.isFinite) &&
        r.width - left - right >= MIN &&
        r.height - top - bottom >= MIN;
      // Links inside running text are text, not targets of their own (WCAG 2.5.8, inline exception).
      const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline';
      return !extended && !inline;
    })
    .map((e) => {
      const r = e.getBoundingClientRect();
      const name = (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24);
      return `${Math.round(r.width)}×${Math.round(r.height)} ${e.tagName.toLowerCase()} "${name}"`;
    });
}

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
    // Polled: a part whose styles arrive a moment after it (a lazily loaded stylesheet) settles within seconds, a
    // target that really is too small stays in the list.
    await expect
      .configure({ soft: true })
      .poll(() => page.evaluate(smallTargets), {
        message: `${path}: hit areas under 44 px`,
        timeout: 5_000,
      })
      .toEqual([]);
  }
});
