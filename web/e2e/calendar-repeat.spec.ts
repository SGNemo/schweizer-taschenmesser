import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test.describe('Calendar: repeating shifts (QA V04)', () => {
  test('an appointment repeating every 2 weeks on Mo–Mi shows on exactly those days, end time visible', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-10-29T10:00:00') });
    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
    await dialog.getByLabel('Titel').fill('Frühdienst');
    await dialog.getByLabel('Datum', { exact: true }).fill('2026-11-02');
    await dialog.getByLabel('Beginn').fill('06:00');
    // The end time and the repeat rule are in the dialog itself, not behind "Mehr Felder".
    await dialog.getByLabel('Ende', { exact: true }).fill('14:30');
    await dialog.getByLabel('Wiederholung').selectOption('weekly');
    await dialog.getByLabel('Alle (Wochen)').fill('2');
    for (const day of ['Mo', 'Di', 'Mi'])
      await dialog.getByRole('button', { name: day, exact: true }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/calendar?view=month&date=2026-11-02');
    await expect(
      page.getByRole('button', { name: 'Montag, 2. November, 1 Eintrag' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Mittwoch, 4. November, 1 Eintrag' }),
    ).toBeVisible();
    // The week in between is free, the one after repeats.
    await expect(
      page.getByRole('button', { name: 'Montag, 9. November', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Montag, 16. November, 1 Eintrag' }),
    ).toBeVisible();

    await page.goto('/calendar?view=day&date=2026-11-02');
    await expect(page.getByText('06:00–14:30').first()).toBeVisible();
  });
});
