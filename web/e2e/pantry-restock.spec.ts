import { expect, test, type Page } from '@playwright/test';
import { enable } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addItem(page: Page, name: string, count: string, min: string) {
  await page.getByRole('button', { name: 'Vorrat hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Vorrat hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Vorrat (Anzahl)').fill(count);
  await dialog.getByLabel('Nachkaufen ab (Anzahl, optional)').fill(min);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('everything that runs low goes to the shopping list with one click; the home widget shows it', async ({
  page,
}) => {
  await enable(page, 'pantry');
  await enable(page, 'lists');
  await page.goto('/pantry');
  await addItem(page, 'Milch', '1', '2');
  await addItem(page, 'Eier', '2', '4');
  await addItem(page, 'Salz', '5', '1'); // enough

  await page.getByRole('button', { name: 'Alle 2 nachkaufen' }).click(); // 1 click
  await expect(page.getByText('2 Dinge an die Einkaufsliste gesendet.')).toBeVisible();

  await page.goto('/lists');
  await expect(page.getByRole('listitem').filter({ hasText: 'Milch' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Eier' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Salz' })).toHaveCount(0);

  await page.goto('/');
  const widget = page.getByTestId('widget-pantry:expiring');
  await expect(widget).toContainText('Milch');
  await expect(widget).toContainText('Wird knapp');
  await expect(widget).toContainText('2 wenig');
});
