import { expect, test, type Page } from '@playwright/test';
import { backSettled, ready } from './helpers';

// The hour grid (and so dragging) exists from 1400 px; phones use lists.
test.use({ viewport: { width: 1600, height: 1000 } });

async function createEvent(page: Page) {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
  await dialog.getByLabel('Titel').fill('Ziehtest');
  await dialog.getByLabel('Datum', { exact: true }).fill('2026-11-03');
  await dialog.getByLabel('Beginn').fill('10:00');
  await dialog.getByLabel('Ende', { exact: true }).fill('11:00');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The editor closes with an in-app URL change (its Back entry pops); a goto in that gap can be aborted.
  await backSettled(page);
  await page.goto('/calendar?view=day&date=2026-11-03');
}

test.describe('Calendar: dragging in the hour grid (plan group)', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse interaction on the desktop grid');
  test.beforeEach(({ page }) => page.clock.install({ time: new Date('2026-11-03T08:00:00') }));

  test('dragging an event down by one hour moves it, undo is offered', async ({ page }) => {
    await createEvent(page);
    const item = page
      .getByRole('group', { name: 'Zeitraster' })
      .getByRole('button', { name: /Ziehtest/ });
    await expect(item).toContainText('10:00');
    // Like below: the line under the title ("in 2 Std · …") comes after the entries and moves the grid.
    await expect(page.getByTestId('calendar-next')).toBeVisible();
    const box = (await item.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 10 + 28, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2, box.y + 10 + 56, { steps: 4 });
    await page.mouse.up();
    await expect(
      page.getByRole('group', { name: 'Zeitraster' }).getByRole('button', { name: /Ziehtest/ }),
    ).toContainText('11:00');
    await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  });

  test('Alt+Arrow moves by a quarter hour without a mouse', async ({ page }) => {
    await createEvent(page);
    const item = page
      .getByRole('group', { name: 'Zeitraster' })
      .getByRole('button', { name: /Ziehtest/ });
    await item.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(
      page.getByRole('group', { name: 'Zeitraster' }).getByRole('button', { name: /Ziehtest/ }),
    ).toContainText('10:15');
  });

  test('drawing over an empty part of the day opens the editor with that slot', async ({
    page,
  }) => {
    await ready(page, '/calendar?view=day&date=2026-11-03');
    // The line under the title ("Heute frei") arrives after the first paint, once the entries are read, and on a
    // first visit it moves the whole grid down by 84 px. A position read before that points somewhere else by the
    // time the mouse gets there (the slot then started at 13:30 or 12:30).
    await expect(page.getByTestId('calendar-free')).toBeVisible();
    // 14:00 sits at the bottom edge of the opened grid (06:00 + eight hours); scroll it into the middle first, or the
    // pointer can land outside the scroll pane and nothing is drawn.
    const hours = page.getByRole('region', { name: 'Stunden' });
    await expect.poll(() => hours.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await hours.evaluate((el) => (el.scrollTop = (el.scrollHeight / 24) * 11));
    const col = page.locator('[data-date="2026-11-03"]');
    const box = (await col.boundingBox())!;
    // 14:00 is 14 hours down the 24-hour column.
    const y = box.y + (box.height / 24) * 14;
    await page.mouse.move(box.x + 40, y + 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, y + 60, { steps: 5 });
    await page.mouse.up();
    const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
    await expect(dialog.getByLabel('Beginn')).toHaveValue('14:00');
    await expect(dialog.getByLabel('Ende', { exact: true })).not.toHaveValue('');
  });
});
