import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** The shared charts (`ui/charts`) on the component sheet: what only a real browser shows. */
async function sheet(page: Page) {
  await ready(page, '/dev/components');
  const charts = page.getByTestId('chart-sheet');
  await charts.scrollIntoViewIfNeeded();
  return charts;
}

test('each chart is a named figure with a table for screen readers; nothing runs past the window', async ({
  page,
}) => {
  const charts = await sheet(page);
  await expect(page.getByRole('figure', { name: 'Ausgaben nach Kategorie' })).toBeVisible();
  const donutTable = page.getByTestId('cs-donut').getByRole('table');
  await expect(donutTable.getByRole('row')).toHaveCount(6);
  await expect(donutTable.getByRole('rowheader').first()).toHaveText('Miete');
  // The table is there for screen readers only.
  expect(
    await donutTable.evaluate((el) => el.parentElement!.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(1);
  await expect(
    page.getByTestId('cs-bars').getByText('12,30 € drüber', { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('cs-trend').getByRole('table').getByRole('row')).toHaveCount(13);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(charts).toBeVisible();
});

test('the trend thins its month labels to the width; the newest month always shows', async ({
  page,
}) => {
  await sheet(page);
  const labels = page.getByTestId('cs-trend').locator('[data-n], [data-w]');
  const shown = await labels.evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).visibility === 'visible').map((el) => el.textContent),
  );
  expect(shown.length).toBeGreaterThan(1);
  expect(shown.length).toBeLessThanOrEqual(8);
  expect(shown).toContain('Nov.');
});

test('"Bewegung reduzieren" draws the charts without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await sheet(page);
  // What moves visibly: animations and transitions that take time. The reduce rule (ui/global.css) shortens every
  // other one to 0.01 ms; on a slow runner such a stub (a `scrollbar-color` transition when the theme settles) can
  // still be listed for a moment and says nothing about the charts.
  const running = await page.getByTestId('chart-sheet').evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => Number(a.effect?.getComputedTiming().duration ?? 0) > 1)
      .map((a) => (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty),
  );
  expect(running).toEqual([]);
});
