import { expect, test } from '@playwright/test';
import { moreFields, ready } from './helpers';

/** Repeating bookings (comfort review, package 6). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

test('a monthly booking books the missed months at the next start; undo takes them away', async ({
  page,
}) => {
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByRole('button', { name: 'Ausgabe', exact: true }).click();
  await dialog.getByLabel('Betrag').fill('850,00');
  await dialog.getByLabel('Datum').fill('2026-07-15');
  await dialog.getByLabel('Empfänger / Titel').fill('Miete');
  await moreFields(page);
  await dialog.getByLabel('Wiederholen').selectOption('monthly');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The next app start books August and September.
  await ready(page, '/finance?tab=transactions');
  await expect(page.getByText('2 wiederkehrende Buchungen angelegt.')).toBeVisible();
  const september = page.getByRole('listitem').filter({ hasText: 'Miete' });
  await expect(september).toHaveCount(1); // 15 Sep, shown in the current month
  await expect(september.first()).toContainText('↻ Monatlich');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(september).toHaveCount(0);
});
