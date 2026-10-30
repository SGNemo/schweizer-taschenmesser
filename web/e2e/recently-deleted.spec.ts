import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

async function createAndDelete(page: Page, title: string) {
  await ready(page, '/vault?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill(title);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('listitem')
    .filter({ hasText: title })
    .getByRole('button', { name: new RegExp(`^${title}`) })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Zuletzt gelöscht', () => {
  test('lists deleted items, restores one and removes another for good', async ({ page }) => {
    await enable(page, 'vault');
    await createAndDelete(page, 'Garantie Waschmaschine');
    await createAndDelete(page, 'Alter Vertrag');

    await ready(page, '/settings/allgemein');
    const section = page.locator('section[aria-labelledby="recently-deleted"]');
    await expect(
      section.getByRole('listitem').filter({ hasText: 'Garantie Waschmaschine' }),
    ).toBeVisible();
    await expect(section.getByRole('listitem').filter({ hasText: 'Alter Vertrag' })).toBeVisible();
    await expect(section.getByRole('listitem').first()).toContainText('Unterlage');

    // restore one
    await section.getByRole('button', { name: 'Garantie Waschmaschine wiederherstellen' }).click();
    await expect(
      section.getByRole('listitem').filter({ hasText: 'Garantie Waschmaschine' }),
    ).toHaveCount(0);

    // remove the other for good: needs a second tap
    const purge = section.getByRole('button', { name: 'Alter Vertrag endgültig löschen' });
    await purge.click();
    await expect(purge).toContainText('Sicher?');
    await purge.click();
    await expect(section.getByTestId('trash-empty')).toBeVisible();

    await ready(page, '/vault');
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Garantie Waschmaschine' }),
    ).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Alter Vertrag' })).toHaveCount(0);
  });

  test('the switch turns the list off and says what that means', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    const section = page.locator('section[aria-labelledby="recently-deleted"]');
    const keep = section.getByRole('switch', { name: 'Gelöschtes 30 Tage aufbewahren' });
    await expect(keep).toHaveAttribute('aria-checked', 'true');
    await keep.click();
    await expect(keep).toHaveAttribute('aria-checked', 'false');
    await expect(section.getByText(/nur direkt über „Rückgängig“/)).toBeVisible();
  });
});
