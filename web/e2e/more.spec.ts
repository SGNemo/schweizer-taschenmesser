import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

/** Missing functions picked in the comfort review (package 5a). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addBooking(page: Page, payee: string, amount: string, date: string) {
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Datum').fill(date);
  await dialog.getByLabel('Empfänger / Titel').fill(payee);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('bookings can be searched across all months and filtered by kind', async ({ page }) => {
  await addBooking(page, 'Zahnarzt Muster', '120,00', '2026-06-10');
  await addBooking(page, 'Bäckerei', '4,50', '2026-09-28');

  await ready(page, '/finance?tab=transactions');
  await expect(page.getByRole('listitem').filter({ hasText: 'Bäckerei' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Zahnarzt' })).toHaveCount(0); // other month

  await page.getByRole('searchbox', { name: 'Buchungen durchsuchen' }).fill('zahnarzt');
  await expect(page.getByText('1 Treffer in allen Monaten')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Zahnarzt Muster' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Bäckerei' })).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Buchungen durchsuchen' }).fill('nichts da');
  await expect(page.getByText('Keine passenden Buchungen.')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buchungen durchsuchen' }).fill('');
  await page.getByRole('button', { name: 'Einnahme', exact: true }).click();
  await expect(page.getByText('Keine passenden Buchungen.')).toBeVisible();
});

test('open gifts of all people in one list; "Verschenkt" is one click and undoable', async ({
  page,
}) => {
  await enable(page, 'people');
  for (const [name, gift] of [
    ['Anna', 'Kochbuch'],
    ['Ben', 'Schal'],
  ] as const) {
    await ready(page, '/people?new=1');
    const dialog = page.getByRole('dialog', { name: 'Person hinzufügen' });
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await dialog.getByLabel('Geburtsdatum').fill('1990-10-03');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page
      .getByRole('button', { name: new RegExp(`^${name}`) })
      .first()
      .click();
    await page.getByRole('button', { name: 'Geschenkidee hinzufügen' }).first().click();
    await page.getByRole('dialog').getByLabel('Idee', { exact: true }).fill(gift);
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  await ready(page, '/people');
  await page.getByRole('button', { name: 'Offene Geschenke' }).click();
  const kochbuch = page.getByRole('listitem').filter({ hasText: 'Kochbuch' });
  await expect(kochbuch).toContainText('Anna');
  await expect(page.getByRole('listitem').filter({ hasText: 'Schal' })).toContainText('Ben');

  await kochbuch.getByRole('button', { name: /als verschenkt markieren/ }).click(); // 1 click
  await expect(page.getByText('Als verschenkt markiert.')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Kochbuch' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Kochbuch' })).toBeVisible();
});
