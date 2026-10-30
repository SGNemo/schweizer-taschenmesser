import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time (the week ends on Sunday 10-04). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addReminder(page: Page, title: string, date: string, time = '20:00') {
  await ready(page, '/calendar?tab=reminders&new=1');
  const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
  await dialog.getByLabel('Titel').fill(title);
  await dialog.getByLabel('Datum').fill(date);
  await dialog.getByLabel('Beginn').fill(time);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function seed(page: Page) {
  await addReminder(page, 'Tabletten nehmen', '2026-09-29');
  await addReminder(page, 'Wasser trinken', '2026-09-30');
  await addReminder(page, 'Miete überweisen', '2026-10-20');
  await addReminder(page, 'Alte Sache', '2026-09-01');
  await ready(page, '/calendar?tab=reminders');
}

const group = (page: Page, id: string) => page.locator(`section[data-group="${id}"]`);
const rowOf = (page: Page, title: string) =>
  page.getByRole('listitem').filter({ has: page.getByRole('button', { name: new RegExp(title) }) });

test.describe('Calm reminders tab (focus audit 2, package 4)', () => {
  test('groups Heute, Diese Woche, Später; Erledigt is folded and opens on a tap', async ({
    page,
  }) => {
    await seed(page);
    await expect(group(page, 'today')).toContainText('Tabletten nehmen');
    await expect(group(page, 'week')).toContainText('Wasser trinken');
    await expect(group(page, 'later')).toContainText('Miete überweisen');

    const done = group(page, 'done');
    const toggle = done.getByRole('button', { name: 'Erledigt ausklappen' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(done.getByText('Alte Sache')).toBeHidden();
    await toggle.click();
    await expect(done.getByText('Alte Sache')).toBeVisible();
    await expect(done.getByText('Beendet')).toBeVisible();
  });

  test('"Erledigt" in the row moves a one-off reminder to the folded group; "Rückgängig" brings it back', async ({
    page,
  }) => {
    await seed(page);
    const row = rowOf(page, 'Tabletten nehmen');
    await row.getByRole('button', { name: 'Erledigt' }).click();
    await expect(page.getByText('Erinnerung erledigt.')).toBeVisible();
    await expect(group(page, 'today')).toHaveCount(0);
    await expect(
      group(page, 'done').getByRole('button', { name: 'Erledigt ausklappen' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(group(page, 'today')).toContainText('Tabletten nehmen');
  });

  test('"Später" is in the "⋯" menu and moves the reminder', async ({ page }) => {
    await seed(page);
    await rowOf(page, 'Wasser trinken').getByRole('button', { name: 'Weitere Aktionen' }).click();
    const menu = page.getByRole('menu');
    for (const name of ['In 10 Min', 'In 1 Std', 'Pausieren', 'Bearbeiten', 'Löschen'])
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'In 1 Std' }).click();
    await expect(page.getByText('Okay, in einer Stunde.')).toBeVisible();
    await expect(group(page, 'today')).toContainText('Wasser trinken');
    await expect(group(page, 'today')).toContainText('11:00');
  });

  test('Pausieren and Bearbeiten stay reachable through the menu', async ({ page }) => {
    await seed(page);
    await rowOf(page, 'Miete überweisen').getByRole('button', { name: 'Weitere Aktionen' }).click();
    await page.getByRole('menuitem', { name: 'Pausieren' }).click();
    const done = group(page, 'done');
    await done.getByRole('button', { name: 'Erledigt ausklappen' }).click();
    await expect(done.getByText('Pausiert', { exact: true })).toBeVisible();

    await rowOf(page, 'Miete überweisen').getByRole('button', { name: 'Weitere Aktionen' }).click();
    await page.getByRole('menuitem', { name: 'Wieder einschalten' }).click();
    await expect(group(page, 'later')).toContainText('Miete überweisen');

    await rowOf(page, 'Miete überweisen').getByRole('button', { name: 'Weitere Aktionen' }).click();
    await page.getByRole('menuitem', { name: 'Bearbeiten' }).click();
    await expect(page.getByRole('dialog', { name: 'Erinnerung bearbeiten' })).toBeVisible();
  });

  test('the row is a real touch target and the page stays calm', async ({ page }, info) => {
    await seed(page);
    const main = page.getByRole('button', { name: /Tabletten nehmen/ });
    const box = (await main.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    if (info.project.name !== 'pixel-7') {
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(h).toBeLessThanOrEqual(page.viewportSize()!.height);
    }
  });
});
