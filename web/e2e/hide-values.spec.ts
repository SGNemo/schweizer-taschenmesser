import { expect, test } from '@playwright/test';
import { openMoreFocus, ready, showAllWidgets } from './helpers';

test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
});

test.describe('Werte ausblenden', () => {
  test('hides the balance card figure, reveals on tap, hides again, survives a reload', async ({
    page,
  }) => {
    await ready(page, '/finance?tab=accounts');
    await page.getByRole('button', { name: 'Konto hinzufügen' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Kontoname').fill('Girokonto');
    await dialog.getByLabel('Anfangssaldo').fill('1234,56');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await ready(page, '/');
    await expect(page.getByTestId('widget-finance:balance')).toContainText(/1\.234,56\s€/);
    await expect(page.getByTestId('sensitive-value')).toHaveCount(0);

    await ready(page, '/settings/barrierefreiheit');
    await openMoreFocus(page);
    const toggle = page.getByRole('switch', { name: 'Werte ausblenden' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await ready(page, '/');
    const card = page.getByTestId('widget-finance:balance');
    await expect(card.getByTestId('sensitive-value')).toBeVisible();
    // Not only invisible: the amount is not in the DOM text at all.
    await expect(card).not.toContainText(/1\.234,56\s€/);

    await page.reload();
    await expect(
      page.getByTestId('widget-finance:balance').getByTestId('sensitive-value'),
    ).toBeVisible();

    await page.getByTestId('widget-finance:balance').getByTestId('sensitive-value').click();
    await expect(page.getByTestId('widget-finance:balance')).toContainText(/1\.234,56\s€/);
    await page.getByTestId('sensitive-rehide').click();
    await expect(
      page.getByTestId('widget-finance:balance').getByTestId('sensitive-value'),
    ).toBeVisible();
  });
});
