import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Invoices round "Tiefe & Politur" p2: search, the past-due area on top, and "Auswählen" → "Als bezahlt
 * markieren" for several at once with one "Rückgängig". Deterministic "today": Sunday 2026-11-15, 10:00.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
});

async function addInvoice(page: Page, payee: string, amount: string, due: string) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung eintragen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill(payee);
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Fällig am').fill(due);
  await dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('search, the past-due area and paying several at once with one undo', async ({ page }) => {
  await addInvoice(page, 'Stadtwerke', '89,90', '2026-11-10');
  await addInvoice(page, 'Telekom', '39,99', '2026-11-30');
  await addInvoice(page, 'Versicherung', '120,00', '2026-12-20');

  const late = page.getByTestId('invoices-late');
  await expect(late).toContainText('Stadtwerke');
  await expect(late).not.toContainText('Telekom');

  const search = page.getByRole('searchbox', { name: 'Rechnungen durchsuchen' });
  await search.fill('tele');
  await expect(page.getByRole('button', { name: /^Telekom/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Stadtwerke/ })).toHaveCount(0);
  await search.fill('');

  await page.getByTestId('invoices-select').click();
  const boxes = page.getByRole('checkbox');
  await expect(boxes).toHaveCount(3);
  await boxes.nth(0).click();
  await boxes.nth(1).click();
  const bar = page.getByRole('region', { name: 'Auswahl' });
  await bar.getByRole('button', { name: 'Als bezahlt markieren' }).click();
  await expect(page.getByText('2 Rechnungen als bezahlt markiert.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Stadtwerke/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Telekom/ })).toHaveCount(0);
  await expect(page.getByTestId('open-total')).toHaveText(/120,00\s€/);

  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /^Stadtwerke/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Telekom/ })).toBeVisible();
  await expect(page.getByTestId('open-total')).toHaveText(/249,89\s€/);
});
