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
    // Nor in the accessibility tree.
    expect(await card.ariaSnapshot()).not.toMatch(/1\.234,56/);
    await expect(card.getByRole('button', { name: /Ausgeblendet/ })).toBeVisible();

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

  // Identity 4.0 (package 0b-2): the head's title row carries the module's one figure; a money figure is hidden there
  // like in the widgets.
  test('the figure in the head of Finanzen is hidden too, in the text and in the accessibility tree', async ({
    page,
  }) => {
    await ready(page, '/finance?tab=accounts');
    await page.getByRole('button', { name: 'Konto hinzufügen' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Kontoname').fill('Girokonto');
    await dialog.getByLabel('Anfangssaldo').fill('1234,56');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await ready(page, '/finance');
    const row = page.getByTestId('module-title-row');
    await expect(row).toContainText(/1\.234,56\s€/);
    await expect(row.getByTestId('sensitive-value')).toHaveCount(0);

    await ready(page, '/settings/barrierefreiheit');
    await openMoreFocus(page);
    const toggle = page.getByRole('switch', { name: 'Werte ausblenden' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await ready(page, '/finance');
    await expect(row.getByTestId('sensitive-value')).toBeVisible();
    await expect(row).not.toContainText(/1\.234,56/);
    expect(await page.getByTestId('module-frame').ariaSnapshot()).not.toMatch(/1\.234,56/);
    // The context line stays and names no amount.
    await expect(row).toContainText('Konten');
    // One tap shows it, until the view is left.
    await row.getByTestId('sensitive-value').click();
    await expect(row).toContainText(/1\.234,56\s€/);
    await ready(page, '/todos');
    await ready(page, '/finance');
    await expect(row.getByTestId('sensitive-value')).toBeVisible();
  });
});
