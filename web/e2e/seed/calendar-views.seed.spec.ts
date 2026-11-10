import { expect } from '@playwright/test';
import { bootDev, SEED_TODAY, test } from './helpers';

/**
 * UI round 6 (docs/qa/round-6/FINDINGS.md S03, S04, U25) on the seeded Dev-Preview (medium, clock 2026-09-29 10:00):
 * month entries are lines with at most three per cell, the week's all-day pane holds three entries per day and never
 * covers a timed block, and the phone toolbar takes at most three rows above the month grid.
 */
test.use({ seeded: { scale: 'medium' } });

test.describe('desktop 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('S03: a month cell shows at most three lines plus "+n weitere"', async ({ page }) => {
    await bootDev(page);
    await page.goto(`/calendar?view=month&date=${SEED_TODAY}`);
    await expect(page.locator('main table')).toBeVisible();
    await expect(page.locator('main td button', { hasText: /weitere$/ }).first()).toBeVisible();
    const perCell = await page
      .locator('main table td')
      .evaluateAll((cells) => cells.map((td) => td.querySelectorAll('li').length));
    // three lines + the "+n" line at most
    expect(Math.max(...perCell)).toBeLessThanOrEqual(4);
  });

  test('S04: the all-day pane holds three entries per day; the 08:00 blocks sit below it', async ({
    page,
  }) => {
    await bootDev(page);
    await page.goto(`/calendar?view=week&date=${SEED_TODAY}`);
    const grid = page.getByRole('group', { name: 'Zeitraster' });
    const pane = grid.getByRole('group', { name: 'Ganztägig und ohne Uhrzeit' });
    await expect(pane).toBeVisible();
    await expect(pane.getByRole('button', { name: /weitere,/ }).first()).toBeVisible();
    const counts = await pane
      .locator('ul')
      .evaluateAll((uls) =>
        uls.map(
          (ul) =>
            [...ul.querySelectorAll('li')].filter((li) => !/weitere/.test(li.textContent ?? ''))
              .length,
        ),
      );
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
    const block = grid
      .locator(`[data-date="${SEED_TODAY}"] button`, { hasText: 'Medikament' })
      .first();
    await expect(block).toBeVisible();
    const paneBox = (await pane.boundingBox())!;
    await expect
      .poll(async () => (await block.boundingBox())!.y)
      .toBeGreaterThanOrEqual(paneBox.y + paneBox.height - 1);
    const body = grid.locator('div[class*="tgBody"]');
    const { height, hour } = await body.evaluate((el) => ({
      height: el.clientHeight,
      hour: el.scrollHeight / 24,
    }));
    expect(height).toBeGreaterThanOrEqual(8 * hour - 1);
  });
});

test.describe('phone 412x915', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

  test('U25: at most three toolbar rows above the month grid', async ({ page }) => {
    await bootDev(page);
    await page.goto(`/calendar?view=month&date=${SEED_TODAY}`);
    const main = page.locator('main');
    await expect(main.locator('table')).toBeVisible();
    const top = (await main.getByRole('button', { name: 'Neuer Termin' }).last().boundingBox())!.y;
    const grid = (await main.locator('table').boundingBox())!.y;
    // Three 44 px rows and their gaps (was five rows, grid at 669 px); the module head band above is not part of it.
    expect(grid - top).toBeLessThan(3 * 44 + 3 * 16 + 8);
    expect(grid).toBeLessThanOrEqual(580);
    // The view switch and the calendar chips share one row.
    const views = main.getByRole('button', { name: 'Monat' });
    const chip = main.getByRole('group', { name: 'Kalender' }).getByRole('button').first();
    expect(Math.abs((await views.boundingBox())!.y - (await chip.boundingBox())!.y)).toBeLessThan(
      8,
    );
  });
});
