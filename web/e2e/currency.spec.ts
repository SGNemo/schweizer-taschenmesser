import { expect, test, type Page } from '@playwright/test';
import { ready, showAllWidgets } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('an account in another currency is shown in its currency and never mixed into the euro sum', async ({
  page,
}) => {
  await ready(page, '/finance?tab=accounts');
  await page.getByRole('switch', { name: 'Mehr Felder anzeigen' }).click();
  await page.getByRole('button', { name: 'Konto hinzufügen' }).click();
  await page.getByLabel('Kontoname').fill('Peso');
  await page.getByLabel('Anfangssaldo').fill('8.500,00');
  await page.getByLabel('Währung', { exact: true }).selectOption('MXN');
  await save(page);
  await expect(page.getByTestId('balance-Peso')).toHaveText(/8[.,]500[.,]00/);
  await expect(page.getByTestId('balance-Peso')).toContainText(/MXN|MX\$/);

  // Two currencies: the overview shows one at a time (euro first), with a switch.
  await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
  const group = page.getByRole('group', { name: 'Währung' });
  await expect(group.getByRole('button', { name: 'EUR' })).toBeVisible();
  await expect(page.getByTestId('hero')).not.toContainText(/MXN|MX\$/);
  await group.getByRole('button', { name: 'MXN' }).click();
  await expect(page.getByTestId('hero')).toHaveText(/8[.,]500[.,]00/);
  await expect(page.getByTestId('hero')).toContainText(/MXN|MX\$/);
});

test('an invoice can be in another currency; the open total lists each currency', async ({
  page,
}) => {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Empfänger').fill('Hotel Cancún');
  await dialog.getByLabel('Betrag').fill('1.200,00');
  await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).click();
  await dialog.getByLabel('Währung', { exact: true }).selectOption('USD');
  await save(page);
  await expect(page.getByTestId('open-total')).toContainText(/USD|\$/);
  await expect(page.getByRole('list').getByText(/1[.,]200[.,]00/)).toBeVisible();
});
