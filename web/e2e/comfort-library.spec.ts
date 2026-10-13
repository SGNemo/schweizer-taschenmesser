import { expect, test } from '@playwright/test';
import { enable, ready } from './helpers';

test('library search finds a module by a purpose word and says when nothing matches', async ({
  page,
}) => {
  await ready(page, '/library');
  const search = page.getByRole('searchbox', { name: 'Module durchsuchen' });
  await search.fill('Abo');
  await expect(page.getByTestId('module-subscriptions')).toBeVisible();
  await expect(page.getByTestId('module-todos')).toHaveCount(0);
  await search.fill('qqqunbekanntqqq');
  await expect(page.getByText('Kein Modul passt.')).toBeVisible();
});

test('an enabled module offers its start data right on its card (no detour via Settings)', async ({
  page,
}) => {
  await enable(page, 'bookmarks');
  // Enabling offers the start-data wizard once; skip it, the button stays on the card.
  await page.getByRole('button', { name: 'Überspringen' }).click();
  const card = page.getByTestId('module-bookmarks');
  await card.getByRole('button', { name: 'Startdaten einrichten' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a module card deep link marks the card', async ({ page }) => {
  await ready(page, '/library#module-calendar');
  await expect(page.locator('#module-calendar')).toHaveAttribute('data-hash-target', 'true');
});
