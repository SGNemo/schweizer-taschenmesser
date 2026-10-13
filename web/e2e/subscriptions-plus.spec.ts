import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Price history and "gekündigt zum" of subscriptions (comfort review, package 5b). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addStreaming(page: Page, first = '2026-10-15') {
  await ready(page, '/subscriptions?new=1');
  const dialog = page.getByRole('dialog', { name: 'Abo hinzufügen' });
  await dialog.getByLabel('Name').fill('Streaming');
  await dialog.getByLabel('Betrag').fill('9,99');
  await dialog.getByLabel('Abbuchung am').fill(first);
  await save(page);
}

test('a price change is kept as history and flagged as "Preis erhöht"', async ({ page }) => {
  await addStreaming(page);
  await page.getByRole('button', { name: /Streaming/ }).click();
  await expect(page.getByTestId('price-history')).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('Betrag').fill('12,99');
  await save(page);

  await expect(page.getByRole('button', { name: /Streaming/ })).toContainText(
    'Preis erhöht (+30 %)',
  );
  await page.getByRole('button', { name: /Streaming/ }).click();
  const history = page.getByTestId('price-history');
  await expect(history).toContainText('29. Sep. 2026');
  await expect(history).toContainText(/9,99\s€ → 12,99\s€ \(\+30 %\)/);
});

test('an unchanged price leaves no history entry', async ({ page }) => {
  await addStreaming(page);
  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Streaming Plus');
  await save(page);
  await page.getByRole('button', { name: /Streaming Plus/ }).click();
  await expect(page.getByTestId('price-history')).toHaveCount(0);
});

test('"Gekündigt zum": charges stop on that date and the totals follow', async ({ page }) => {
  await addStreaming(page, '2026-08-15');
  await expect(page.getByTestId('total-month')).toHaveText(/9,99\s€/);

  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByLabel('Gekündigt zum (optional)').fill('2026-10-20');
  await save(page);
  const row = page.getByRole('button', { name: /Streaming/ });
  await expect(row).toContainText('Gekündigt zum 20. Okt. 2026');
  await expect(row).toContainText('Nächste Abbuchung: 15. Okt. 2026');
  await expect(page.getByTestId('total-month')).toHaveText(/9,99\s€/); // still charged once

  // after the date nothing is charged any more
  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByLabel('Gekündigt zum (optional)').fill('2026-09-20');
  await save(page);
  await expect(page.getByRole('button', { name: /Streaming/ })).toContainText('Beendet');
  await expect(page.getByTestId('total-month')).toHaveText(/0,00\s€/);
});

test('a cancellation date before the first charge cannot be saved (browser validation)', async ({
  page,
}) => {
  await addStreaming(page);
  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByLabel('Gekündigt zum (optional)').fill('2026-09-01');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
