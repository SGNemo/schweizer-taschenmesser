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

  test('the figure in the head of Rechnungen (the open sum) is hidden too', async ({ page }) => {
    await ready(page, '/');
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('invoices_invoice', 'readwrite');
            tx.objectStore('invoices_invoice').put({
              id: 'inv1',
              payee: 'Stadtwerke',
              amountMinor: 4200,
              dueDate: '2099-10-05',
              status: 'open',
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
    );
    await ready(page, '/invoices');
    const row = page.getByTestId('module-title-row');
    await expect(row).toContainText(/42,00\s€/);

    await ready(page, '/settings/barrierefreiheit');
    await openMoreFocus(page);
    const toggle = page.getByRole('switch', { name: 'Werte ausblenden' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    await ready(page, '/invoices');
    await expect(row.getByTestId('sensitive-value')).toBeVisible();
    await expect(row).not.toContainText(/42,00/);
    expect(await page.getByTestId('module-frame').ariaSnapshot()).not.toMatch(/42,00/);
  });
});

// Package G-b (UI audit 2026-11): the net worth on the tab "Verlauf" of Finanzen is a money figure like the others.
test('the net worth on the tab "Verlauf" is hidden: head, rows by kind and the amounts around the curve', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await page.goto('/finance');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['finance_account', 'finance_transaction'], 'readwrite');
          const row = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
          const accounts = tx.objectStore('finance_account');
          accounts.put({ ...row, id: 'g', name: 'Giro', openingBalanceMinor: 123456, order: 0 });
          accounts.put({
            ...row,
            id: 's',
            name: 'Tagesgeld',
            openingBalanceMinor: 500000,
            order: 1,
            kind: 'savings',
          });
          accounts.put({
            ...row,
            id: 'u',
            name: 'Dollar',
            openingBalanceMinor: 77700,
            order: 2,
            currency: 'USD',
          });
          tx.objectStore('finance_transaction').put({
            ...row,
            id: 't',
            accountId: 'g',
            kind: 'expense',
            amountMinor: 3456,
            date: '2026-08-10',
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto('/finance?tab=trend');
  const main = page.locator('main');
  await expect(page.getByTestId('hero')).toHaveText(/6\.200,00\s€/);
  await expect(page.getByTestId('net-worth-savings')).toHaveText(/5\.000,00\s€/);
  await expect(page.getByTestId('net-worth-USD')).toHaveText(/777,00\s\$/);
  await expect(page.getByTestId('net-worth-chart')).toBeVisible();
  await expect(main.getByTestId('sensitive-value')).toHaveCount(0);

  await page.goto('/settings/barrierefreiheit');
  await expect(page.locator('main h1')).toBeVisible();
  await openMoreFocus(page);
  const toggle = page.getByRole('switch', { name: 'Werte ausblenden' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.goto('/finance?tab=trend');
  // Head figure, two rows by kind, the row of the other currency, the foot of the curve.
  await expect(main.getByTestId('sensitive-value')).toHaveCount(5);
  await expect(page.getByTestId('net-worth-chart')).toBeVisible();
  // No amount in the text, none in the accessibility tree (the curve's label, the table for screen readers).
  await expect(main).not.toContainText(/\d,\d\d\s[€$]/);
  expect(await main.ariaSnapshot()).not.toMatch(/\d,\d\d\s[€$]/);
  // The context lines stay: they name no amount.
  await expect(page.getByTestId('module-title-row')).toContainText('Vermögen · 2 Konten');
  await expect(page.getByTestId('net-worth-context')).toBeVisible();
  // One tap shows a row's amount again.
  await page.getByTestId('net-worth-savings').getByTestId('sensitive-value').click();
  await expect(page.getByTestId('net-worth-savings')).toContainText(/5\.000,00\s€/);
});
