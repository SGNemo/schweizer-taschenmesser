import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Recurring invoices (comfort review, package 5c). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addRent(page: Page) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill('Vermieter');
  await dialog.getByLabel('Betrag').fill('1200,00');
  await dialog.getByLabel('Fällig am').fill('2026-10-01');
  await dialog.getByLabel('Wiederholen').selectOption('monthly');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('paying a repeating invoice brings the next one; undo takes it away', async ({ page }) => {
  await addRent(page);
  const rows = page.getByRole('listitem').filter({ hasText: 'Vermieter' });
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('↻ Monatlich');

  await rows
    .first()
    .getByRole('button', { name: /Als bezahlt markieren|bezahlt/ })
    .first()
    .click(); // 1 click
  await expect(page.getByText('Als bezahlt markiert.')).toBeVisible();
  await expect(rows).toHaveCount(1); // the paid one moved to "Bezahlt", the next is open
  await expect(rows.first()).toContainText('1. Nov.');
  await expect(rows.first()).toContainText('↻ Monatlich');

  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('1. Okt.');
});

test('the repeat is kept when the invoice is edited', async ({ page }) => {
  await addRent(page);
  await page.getByRole('button', { name: /Vermieter/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Wiederholen')).toHaveValue('monthly');
});
