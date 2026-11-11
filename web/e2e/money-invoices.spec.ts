import { expect, test, type Page } from '@playwright/test';
import { moreFields, ready, showAllWidgets } from './helpers';
import { openEditor } from './money-helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addInvoice(page: Page, payee: string, amount: string, due: string) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill(payee);
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Fällig am').fill(due);
  await save(page);
}

// A 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Invoices: part payments, payment data, attachment', () => {
  test('a part payment leaves the rest open and is booked in finance; the last one pays the invoice', async ({
    page,
  }) => {
    await addInvoice(page, 'Stadtwerke', '100,00', '2026-10-05');
    await openEditor(page, page.getByRole('button', { name: /^Stadtwerke/ }));
    const dialog = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
    await dialog.getByLabel('Gezahlte Summe').fill('40,00');
    await dialog.getByRole('button', { name: 'Teilzahlung erfassen' }).click();
    await expect(dialog.getByTestId('payment-rest')).toContainText(/60,00\s€/);
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();

    await expect(page.getByTestId('open-total')).toHaveText(/60,00\s€/);
    await expect(page.getByRole('button', { name: /^Stadtwerke/ })).toContainText(
      'Teilweise bezahlt',
    );

    // The booking is written by an async finance handler after the dialog: wait for it before
    // leaving the page, or the navigation cuts it off (docs/howto/gotchas.md; flaked ~1 in 6).
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number>((resolve, reject) => {
              const open = indexedDB.open('taschenmesser');
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const db = open.result;
                const req = db
                  .transaction('finance_transaction', 'readonly')
                  .objectStore('finance_transaction')
                  .count();
                req.onsuccess = () => {
                  db.close();
                  resolve(req.result);
                };
                req.onerror = () => reject(req.error);
              };
            }),
        ),
      )
      .toBeGreaterThanOrEqual(1);
    await ready(page, '/finance?tab=transactions');
    await expect(page.getByRole('listitem').filter({ hasText: /^Stadtwerke/ })).toContainText(
      /−40,00\s€/,
    );

    await ready(page, '/invoices');
    await openEditor(page, page.getByRole('button', { name: /^Stadtwerke/ }));
    const again = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
    await again.getByLabel('Gezahlte Summe').fill('60,00');
    await again.getByRole('button', { name: 'Teilzahlung erfassen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('open-total')).toHaveText(/0,00\s€/);
    await page.getByRole('button', { name: 'Bezahlt', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Stadtwerke/ })).toBeVisible();
  });

  test('a payment above the rest is refused with the rest named', async ({ page }) => {
    await addInvoice(page, 'Stadtwerke', '100,00', '2026-10-05');
    await openEditor(page, page.getByRole('button', { name: /^Stadtwerke/ }));
    const dialog = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
    await dialog.getByLabel('Gezahlte Summe').fill('150,00');
    await dialog.getByRole('button', { name: 'Teilzahlung erfassen' }).click();
    await expect(dialog.getByRole('alert')).toContainText(/Höchstens 100,00\s€/);
  });

  test('an IBAN with a typo gets a calm hint; a valid one does not', async ({ page }) => {
    await ready(page, '/invoices?new=1');
    const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
    await moreFields(page);
    const iban = dialog.getByLabel('IBAN des Empfängers');
    await iban.fill('DE89 3704 0044 0532 0130 01');
    await expect(dialog.getByRole('status')).toContainText('nicht vollständig');
    await iban.fill('DE89 3704 0044 0532 0130 00');
    await expect(dialog.getByText('nicht vollständig')).toHaveCount(0);
  });

  test('payment data are copied as one block from the row menu', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ready(page, '/invoices?new=1');
    const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
    await dialog.getByLabel('Empfänger', { exact: true }).fill('Stadtwerke');
    await dialog.getByLabel('Betrag').fill('89,90');
    await dialog.getByLabel('Fällig am').fill('2026-10-05');
    await moreFields(page);
    await dialog.getByLabel('IBAN des Empfängers').fill('DE89370400440532013000');
    await save(page);
    const row = page.getByRole('listitem').filter({ hasText: /^Stadtwerke/ });
    await row
      .getByRole('button', { name: /Aktionen|Menü|Mehr/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Zahlungsdaten kopieren' }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Stadtwerke');
    expect(text).toContain('DE89 3704 0044 0532 0130 00');
    expect(text).toMatch(/89,90\s€/);
  });

  test('a photo is attached, previewed and still there after reopening', async ({ page }) => {
    await addInvoice(page, 'Stadtwerke', '89,90', '2026-10-05');
    await openEditor(page, page.getByRole('button', { name: /^Stadtwerke/ }));
    const dialog = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
    await moreFields(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'beleg.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(dialog.getByRole('img', { name: 'Vorschau: beleg.png' })).toBeVisible();
    await expect(dialog.getByText('bleibt auf diesem Gerät')).toBeVisible();
    await save(page);

    await openEditor(page, page.getByRole('button', { name: /^Stadtwerke/ }));
    const again = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
    await moreFields(page);
    await expect(again.getByRole('img', { name: 'Vorschau: beleg.png' })).toBeVisible();
  });

  test('the head shows the open sum; the first row pays the next invoice', async ({ page }) => {
    await addInvoice(page, 'Stadtwerke', '89,90', '2026-10-05');
    await expect(page.getByTestId('invoices-head')).toContainText(/89,90\s€/);
    await expect(page.getByTestId('invoices-head')).toContainText('1 Rechnung');
    // The head has no "Nächste bezahlen" any more (one entry per page): the invoice due first is the first row
    // of the list, and its own button pays it.
    await expect(page.getByRole('button', { name: /Nächste bezahlen/ })).toHaveCount(0);
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Stadtwerke' })
      .getByRole('button', { name: 'Als bezahlt markieren' })
      .click();
    await expect(page.getByTestId('invoices-head')).toContainText('Nichts offen');
  });
});
