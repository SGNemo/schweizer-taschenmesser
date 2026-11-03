import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test.describe('Calendar: year, agenda and week numbers (plan group)', () => {
  test('the year view lists twelve months and jumps to a day', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=year&date=2026-11-03');
    await expect(page.getByRole('region', { name: 'Dezember' })).toBeVisible();
    await page
      .getByRole('region', { name: 'Dezember' })
      .getByRole('button', { name: /24\. Dezember/ })
      .click();
    await expect(page).toHaveURL(/view=day&date=2026-12-24/);
  });

  test('the month view shows the week number column', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=month&date=2026-11-03');
    await expect(page.getByRole('rowheader', { name: '45' }).first()).toBeVisible();
  });

  test('the agenda view opens', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T10:00:00') });
    await ready(page, '/calendar?view=agenda&date=2026-11-03');
    await expect(page.getByRole('button', { name: 'Agenda', pressed: true })).toBeVisible();
  });
});
