import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Invoices round "Tiefe & Politur" p1: the tab „Überblick“ – three figures, the donut by payee (open / paid)
 * and the paid months. Deterministic "today": Sunday 2026-11-15, 10:00 local time.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
});

async function addInvoice(page: Page, payee: string, amount: string, due: string) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung eintragen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill(payee);
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Fällig am').fill(due);
  await dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('the overview shows past due and paid this month, by payee and per month', async ({
  page,
}) => {
  await addInvoice(page, 'Stadtwerke', '89,90', '2026-11-10');
  await addInvoice(page, 'Telekom', '39,99', '2026-11-30');
  await addInvoice(page, 'Hausverwaltung', '750,00', '2026-11-01');
  // Pay one from the list (today, so it counts for November).
  await page
    .getByRole('button', { name: /^Hausverwaltung/ })
    .locator('xpath=ancestor::li[1]')
    .getByRole('button', { name: 'Als bezahlt markieren' })
    .click();
  await expect(page.getByRole('button', { name: /^Hausverwaltung/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Überblick', exact: true }).click();
  const ov = page.getByTestId('invoices-overview');
  await expect(page.getByTestId('invoices-head')).toContainText(/129,89\s€/);
  await expect(ov.getByTestId('invoices-figure-late')).toContainText('Frist vorbei');
  await expect(ov.getByTestId('invoices-figure-late')).toContainText(/89,90\s€/);
  await expect(ov.getByTestId('invoices-figure-paid')).toContainText('Bezahlt im November');
  await expect(ov.getByTestId('invoices-figure-paid')).toContainText(/750,00\s€/);

  const donut = ov.getByTestId('invoices-donut');
  await expect(donut).toContainText('Telekom');
  await ov.getByRole('button', { name: 'Bezahlt, 12 Monate' }).click();
  await expect(ov.getByTestId('invoices-donut')).toContainText('Hausverwaltung');
  await expect(ov.getByTestId('invoices-donut')).not.toContainText('Telekom');
  await expect(ov.getByTestId('invoices-months')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('[data-testid="invoices-overview"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('the overview of an empty module says so calmly', async ({ page }) => {
  await ready(page, '/invoices');
  await page.getByRole('button', { name: 'Überblick', exact: true }).click();
  const ov = page.getByTestId('invoices-overview');
  await expect(ov.getByTestId('invoices-figure-late')).toContainText('Alle Fristen laufen noch.');
  await expect(ov.getByTestId('invoices-donut')).toContainText('Gerade ist nichts offen.');
  await expect(ov.getByTestId('invoices-months')).toContainText(
    'In den letzten 12 Monaten noch nichts bezahlt.',
  );
});
