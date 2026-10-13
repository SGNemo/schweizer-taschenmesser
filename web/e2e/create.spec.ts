import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

/** Creating with fewer steps (docs/product/comfort, package 2). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const input = (page: Page) => page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('an invoice from one line of text: "r 89,90 Swisscom 31.10." and Enter', async ({ page }) => {
  await enable(page, ['invoices']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await input(page).fill('r 89,90 Swisscom 31.10.');
  await expect(page.getByTestId('capture-chips')).toContainText('Rechnungen');
  await input(page).press('Enter');
  await expect(page.getByText(/Gespeichert in/)).toBeVisible();
  await ready(page, '/invoices');
  const row = page.getByRole('listitem').filter({ hasText: 'Swisscom' });
  await expect(row).toContainText('89,90');
  await expect(row).toContainText('Fällig am');
});

test('a note with the "n " prefix lands in the notes without choosing a type', async ({ page }) => {
  await enable(page, ['notes']);
  await page.goto('/');
  await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
  await input(page).fill('n Idee für den Garten');
  await expect(page.getByTestId('capture-chips')).toContainText('Notizen');
  await input(page).press('Enter');
  await expect(page.getByText(/Gespeichert in/)).toBeVisible();
  await ready(page, '/notes');
  await expect(page.getByText('Idee für den Garten')).toBeVisible();
});

test('a repeat booking takes category and account of the last booking of the payee', async ({
  page,
}) => {
  await ready(page, '/finance?new=1');
  let dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByLabel('Betrag').fill('45,00');
  await dialog.getByLabel('Empfänger / Titel').fill('Migros');
  await dialog.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
  await save(page);

  await ready(page, '/finance?new=1');
  dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByLabel('Betrag').fill('12,00');
  await dialog.getByLabel('Empfänger / Titel').fill('migros');
  await expect(dialog.getByLabel('Kategorie')).toHaveValue(/.+/);
  await expect(dialog.getByLabel('Kategorie').locator('option:checked')).toHaveText('Lebensmittel');
  // a different payee clears what was suggested
  await dialog.getByLabel('Empfänger / Titel').fill('Kiosk');
  await expect(dialog.getByLabel('Kategorie')).toHaveValue('');
});

test('"Duplizieren" copies an invoice one month later and opens the copy', async ({ page }) => {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Empfänger', { exact: true }).fill('Vermieter');
  await dialog.getByLabel('Betrag').fill('1200,00');
  await dialog.getByLabel('Fällig am').fill('2026-10-01');
  await save(page);

  await page.getByRole('button', { name: /Vermieter/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Duplizieren' }).click();
  await expect(page.getByText(/Dupliziert/)).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Fällig am')).toHaveValue('2026-11-01');
  await expect(page.getByRole('dialog').getByLabel('Betrag')).toHaveValue('1200,00');
  await save(page);
  await expect(page.getByRole('listitem').filter({ hasText: 'Vermieter' })).toHaveCount(2);
});

test('"Duplizieren" on a booking opens a copy dated today; undo removes it', async ({ page }) => {
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByLabel('Betrag').fill('950,00');
  await dialog.getByLabel('Empfänger / Titel').fill('Miete');
  await dialog.getByLabel('Datum').fill('2026-09-01');
  await save(page);

  await ready(page, '/finance?tab=transactions&month=2026-09');
  await page.getByRole('listitem').filter({ hasText: 'Miete' }).getByRole('button').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Duplizieren' }).click();
  await expect(page.getByRole('dialog').getByLabel('Datum')).toHaveValue('2026-09-29');
  await expect(page.getByRole('dialog').getByLabel('Betrag')).toHaveValue('950,00');
});

test('a new person has no birthday date preset', async ({ page }) => {
  await enable(page, ['people']);
  await ready(page, '/people?new=1');
  await expect(page.getByRole('dialog').getByLabel('Geburtsdatum')).toHaveValue('');
});
