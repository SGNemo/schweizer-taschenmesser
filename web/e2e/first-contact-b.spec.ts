import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

/**
 * Round 5, person B (office clerk, Excel, Sparkasse): the three tasks of the first 15 minutes on a
 * fresh installation. Finding ids refer to docs/qa/round-5/b/FINDINGS.md.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-08T10:00:00'));
});

const sparkasse = () =>
  readFileSync(resolve(process.cwd(), '../docs/qa/round-5/b/sparkasse-demo.csv'));

async function importStatement(page: Page) {
  // Straight from the module settings, before the finance page was ever opened (B01).
  await ready(page, '/settings/module/finance');
  await page
    .locator('section[aria-labelledby="module-finance"]')
    .getByRole('button', { name: 'Importieren' })
    .click();
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await dialog.getByRole('button', { name: /Kontoauszug importieren/ }).click();
  await expect(dialog.getByLabel('Buchen auf Konto')).toHaveValue(/.+/);
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Datei wählen …' }).click();
  await (await chooser).setFiles({ name: 'umsatz.csv', mimeType: 'text/csv', buffer: sparkasse() });
  await expect(dialog.getByText('Erkannt: Sparkasse (CSV-CAMT)')).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('Rewe Markt Müllerstraße')).toBeVisible();
  await dialog.getByRole('button', { name: '10 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('10 Einträge wurden importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();
}

test('B01/B03: a Sparkasse file on a fresh app is booked and fills a grocery budget', async ({
  page,
}) => {
  await importStatement(page);
  await ready(page, '/finance?tab=transactions');
  await expect(page.getByText(/Lebensmittel · Girokonto/).first()).toBeVisible();

  await enable(page, 'budgets'); // part of the "Finanz-Fokus" profile
  await ready(page, '/budgets');
  await page.getByRole('button', { name: /Budget (hinzufügen|eintragen)/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
  await dialog.getByLabel('Limit pro Monat').fill('400');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Rewe 54,37 + Bäckerei 6,80 in November.
  await expect(
    page.getByRole('button', { name: /Lebensmittel 61,17 € von 400,00 €/ }),
  ).toBeVisible();
});

test('B02/B07: the export sits next to the bookings and opens in Excel', async ({ page }) => {
  await importStatement(page);
  await ready(page, '/finance?tab=transactions');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Als CSV exportieren' }).click();
  const file = await (await download).path();
  const bytes = readFileSync(file);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = bytes.toString('utf8');
  expect(text).toContain('Rewe Markt Müllerstraße;Lebensmittel;Ausgabe;-54,37;');
});

test('B06: after importing older bookings the balance can be set to what the bank shows', async ({
  page,
}) => {
  await importStatement(page);
  await ready(page, '/finance?tab=accounts');
  await page.getByTestId('balance-Girokonto').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Kontostand heute laut Bank/).fill('1.250,00');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('balance-Girokonto')).toHaveText(/1\.250,00\s€/);
});

test('B04: with ToDos off the calm overview shows the month card', async ({ page }) => {
  await page.goto('/library');
  const card = page.getByTestId('module-todos');
  const toggle = card.getByRole('switch', { name: /einschalten|ausschalten/ });
  await expect(toggle).toBeEnabled();
  if (await toggle.isChecked()) await toggle.click();
  await expect(toggle).not.toBeChecked();
  await ready(page, '/');
  // A fresh app starts in the calm view ("Ruhig").
  await expect(page.getByTestId('widget-finance:month')).toBeVisible();
  await expect(page.getByTestId('widget-finance:balance')).toHaveCount(0);
});
