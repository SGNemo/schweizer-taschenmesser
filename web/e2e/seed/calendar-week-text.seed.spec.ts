import { expect } from '@playwright/test';
import { bootDev, SEED_TODAY, test } from './helpers';
import { weekGridTextFaults } from './weekGridText';

/**
 * UI audit 2026-11, AE4 on the seeded Dev-Preview (medium, clock 2026-09-29 10:00): in the week's hour grid no title
 * breaks inside a word and no line is cut. At 1440 px with the agenda open a day column is about 98 px: overlapping
 * entries fold into a stack instead of lanes of 28 to 45 px.
 */
test.use({ seeded: { scale: 'medium' } });

for (const size of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`week grid text, ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('AE4: whole lines, no word broken, no lane below 4.5 rem', async ({ page }) => {
      await bootDev(page);
      await page.goto(`/calendar?view=week&date=${SEED_TODAY}`);
      const grid = page.getByRole('group', { name: 'Zeitraster' });
      await expect(grid.locator(`[data-date="${SEED_TODAY}"] button`).first()).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Agenda' })).toBeVisible();
      await expect(grid.locator('[data-stack]').first()).toBeVisible();
      await expect.poll(() => weekGridTextFaults(page)).toEqual([]);
      // A stack names its entries one per row; the full title and the time are in the tooltip.
      const row = grid.locator('[data-stack] button', { hasText: 'Schwimmen' });
      await expect(row).toHaveAttribute('title', /18:30.*Sport: Schwimmen/);
    });
  });
}
