import { expect } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, startSeeded } from './guards';

/**
 * Forced colours keep the hairlines (UI audit 2026-11, package 0a-1b). In that mode the system drops shadows and
 * paints every background in one colour, so tints and depth say nothing: what still separates things is a line. The
 * top bar keeps its line to the page, and the rows of a list keep the line between them.
 */
test.use({
  viewport: DESKTOP,
  forcedColors: 'active',
  seeded: { scale: 'small', desktop: true, preview: true },
});

test('the top bar keeps its line to the page', async ({ page }) => {
  await startSeeded(page);
  await openPage(page, '/todos');
  const width = await page
    .locator('header')
    .first()
    .evaluate((e) => parseFloat(getComputedStyle(e).borderBottomWidth));
  expect(width).toBeGreaterThanOrEqual(1);
});

for (const path of ['/todos', '/invoices', '/vault']) {
  test(`rows of the list on ${path} keep a line between them`, async ({ page }) => {
    await startSeeded(page);
    await openPage(page, path);
    const lines = await page.evaluate(() => {
      const rows = [...document.querySelectorAll<HTMLElement>('main li')].filter((li) =>
        li.querySelector('[data-row]'),
      );
      // A row after another row in the same list: one of the two draws the line (top of this, bottom of the previous).
      return rows
        .filter((li) => li.previousElementSibling?.querySelector('[data-row]'))
        .map((li) => {
          const own = getComputedStyle(li);
          const prev = getComputedStyle(li.previousElementSibling!);
          const all = (s: CSSStyleDeclaration) =>
            ['Top', 'Right', 'Bottom', 'Left'].every(
              (side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) >= 1,
            );
          return (
            parseFloat(own.borderTopWidth) >= 1 ||
            parseFloat(prev.borderBottomWidth) >= 1 ||
            all(own)
          );
        });
    });
    expect(lines.length, 'rows that follow another row').toBeGreaterThan(0);
    expect(lines.filter((ok) => !ok).length, 'rows without a line to the row above').toBe(0);
  });
}
