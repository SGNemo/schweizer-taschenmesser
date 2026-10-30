import { expect, test } from '@playwright/test';
import { enable, moreFields, ready } from './helpers';

// The fixed test day is 2026-09-29 (see playwright config).
test.describe('Deadlines (B08, V15)', () => {
  test('a missed cancellation deadline is shown calmly in list, widget and calendar', async ({
    page,
  }) => {
    await enable(page, 'vault');
    await ready(page, '/vault?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Zeitschrift');
    await dialog.getByLabel('Ende / Ablauf').fill('2026-12-31');
    // 4 months = 120 days → deadline 2026-09-02, already behind us
    await dialog.getByRole('spinbutton', { name: 'Kündigungsfrist' }).fill('4');
    await dialog.getByLabel('Einheit').selectOption('months');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const row = page.getByRole('button', { name: /Zeitschrift/ });
    await expect(row).toContainText('Frist vorbei am 2. Sep. 2026');
    await expect(row).not.toContainText('Jetzt kündigen');

    await ready(page, '/calendar?view=week&date=2026-08-31');
    await expect(page.getByText(/Frist vorbei: Zeitschrift/).first()).toBeVisible();
  });

  test('subscription: notice in months, "Kündigen bis" large, no 31-day grid', async ({ page }) => {
    await ready(page, '/subscriptions?new=1');
    const dialog = page.getByRole('dialog', { name: 'Abo hinzufügen' });
    await dialog.getByLabel('Name').fill('Jahreszeitung');
    await dialog.getByLabel('Betrag').fill('120');
    await dialog.getByLabel('Abbuchung am').fill('2026-12-01');
    await dialog.getByLabel('Wiederholung').selectOption('yearly');
    await moreFields(page);
    await dialog.getByRole('spinbutton', { name: 'Kündigungsfrist' }).fill('3');
    await dialog.getByLabel('Einheit').selectOption('months');
    // 3 months = 90 days before the charge; the 2026 deadline (2 Sep) is behind us, the next is 2027
    await expect(dialog.getByTestId('cancel-by')).toContainText('Kündigen bis');
    await expect(dialog.getByTestId('cancel-by')).toContainText('2. Sep. 2027');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // the deadline of the first charge is behind us: calm note, the next reachable one is named
    const row = page.getByRole('button', { name: /Jahreszeitung/ });
    await expect(row).toContainText('Frist vorbei am 2. Sep. 2026');

    await page.getByRole('button', { name: /Jahreszeitung/ }).click();
    const edit = page.getByRole('dialog', { name: 'Abo bearbeiten' });
    await edit.getByLabel('Wiederholung').selectOption('monthly');
    await expect(edit.getByLabel('Wiederholung')).toHaveValue('monthly');
    await expect(edit.getByLabel('Tag des Monats')).toHaveCount(0);
  });
});
