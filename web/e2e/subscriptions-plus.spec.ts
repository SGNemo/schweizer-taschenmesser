import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Price history and "gekündigt zum" of subscriptions (comfort review, package 5b). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Speichern|.+ eintragen)$/ })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addStreaming(page: Page, first = '2026-10-15') {
  await ready(page, '/subscriptions?new=1');
  const dialog = page.getByRole('dialog', { name: 'Abo eintragen' });
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
  await expect(row).toContainText(/Gekündigt zum 20\. Okt\./);
  await expect(row).toContainText(/Nächste Abbuchung: 15\. Okt\./);
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
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^(Speichern|.+ eintragen)$/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('the row menu pauses a subscription (2 clicks) and the delete swipe action is undoable', async ({
  page,
  isMobile,
}) => {
  // The phone's row has no "⋯" (0b-8 G4: its entries are in the dialog and the swipe); see the next test.
  test.skip(isMobile, 'desktop row menu');
  await addStreaming(page);
  // The head also lists the next charges as items, so pick the row that has the actions button.
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Streaming' })
    .filter({ has: page.getByRole('button', { name: 'Weitere Aktionen' }) });
  await row.getByRole('button', { name: 'Weitere Aktionen' }).click(); // click 1
  await page.getByRole('menuitem', { name: 'Pausieren' }).click(); // click 2
  await expect(row).toContainText('Pausiert');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(row).not.toContainText('Pausiert');

  // The toasts of the two actions above stack over the row on a phone (they sit above the "+"); close them like a person would.
  const closeToast = page.getByRole('status').getByRole('button', { name: 'Schließen' });
  while ((await closeToast.count()) > 0) await closeToast.first().click();
  await row.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(row).toHaveCount(1);
});

test('phone: pausing is in the dialog, deleting is the swipe and the dialog (0b-8 G4, no "⋯" per row)', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'phone rows');
  await addStreaming(page);
  const row = page.getByRole('listitem').filter({ hasText: 'Streaming' });
  await expect(row.getByRole('button', { name: 'Weitere Aktionen' })).toHaveCount(0);
  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByRole('switch', { name: 'Aktiv' }).click();
  await save(page);
  await expect(row).toContainText('Pausiert');
  await page.getByRole('button', { name: /Streaming/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(row).toHaveCount(0);
});

test('0b-8 G8: the dialog asks only how often; interval and end wait behind "Mehr Felder"', async ({
  page,
}) => {
  await ready(page, '/subscriptions?new=1');
  const dialog = page.getByRole('dialog', { name: 'Abo eintragen' });
  await expect(dialog.getByLabel('Wiederholung')).toBeVisible();
  await expect(dialog.getByLabel('Alle (Monate)')).toHaveCount(0);
  await expect(dialog.getByLabel('Ende', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: /Mehr Felder/ }).click();
  await dialog.getByLabel('Alle (Monate)').fill('3');
  await dialog.getByLabel('Name').fill('Quartals-Abo');
  await dialog.getByLabel('Betrag').fill('30');
  await save(page);
  // An abo with an interval of its own shows that field at once when it opens again (nothing in use is hidden).
  await page.getByRole('button', { name: /Quartals-Abo/ }).click();
  await expect(page.getByRole('dialog').getByLabel('Alle (Monate)')).toHaveValue('3');
});

test('"Gekündigt zum" says the first allowed day when an earlier one is typed', async ({
  page,
}) => {
  await addStreaming(page);
  await page.getByRole('button', { name: /Streaming/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Gekündigt zum (optional)').fill('01.09.2026');
  await dialog.getByLabel('Gekündigt zum (optional)').blur();
  await expect(dialog.getByRole('alert')).toContainText('Frühestens am 15.10.2026.');
});
