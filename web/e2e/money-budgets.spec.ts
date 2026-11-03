import { expect, test, type Page } from '@playwright/test';
import { enable, moreFields, showAllWidgets } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time (day 29 of 30, third quarter). */
test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function spend(page: Page, amount: string, category: string, date = '2026-09-20') {
  await open(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByRole('button', { name: 'Ausgabe', exact: true }).click();
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Datum').fill(date);
  await dialog.getByLabel('Kategorie').selectOption({ label: category });
  await save(page);
  // Closing the dialog drops `?new=1` from the address; let that settle before the next navigation.
  await expect(page).not.toHaveURL(/new=1/);
}

test.describe('Budgets: periods, carry-over, forecast, history, goal plan', () => {
  test('a quarterly budget sums the quarter and names it', async ({ page }) => {
    await enable(page, 'budgets');
    await spend(page, '40,00', 'Lebensmittel', '2026-07-10');
    await spend(page, '35,00', 'Lebensmittel', '2026-09-10');
    await open(page, '/budgets');
    await page.getByRole('button', { name: 'Budget hinzufügen' }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('300');
    await moreFields(page);
    await editor.getByLabel('Zeitraum', { exact: true }).selectOption('quarter');
    await save(page);
    const card = page.getByRole('listitem').filter({ hasText: 'Lebensmittel' });
    await expect(card).toContainText(/75,00\s€/); // July + September
    await expect(card).toContainText('Q3 2026');
  });

  test('carry-over adds what was left last period to the limit', async ({ page }) => {
    await enable(page, 'budgets');
    await spend(page, '20,00', 'Lebensmittel', '2026-08-10'); // 100 € limit: 80 € left in August
    await open(page, '/budgets');
    await page.getByRole('button', { name: 'Budget hinzufügen' }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('100');
    await moreFields(page);
    await editor.getByRole('switch', { name: /Rest in den nächsten Zeitraum/ }).click();
    await save(page);
    const card = page.getByRole('listitem').filter({ hasText: 'Lebensmittel' });
    await expect(card).toContainText(/80,00\s€ Übertrag/);
    await expect(card).toContainText(/180,00\s€/); // limit now 100 + 80
  });

  test('the forecast line appears when the pace lands above the limit; the history lists periods', async ({
    page,
  }) => {
    await enable(page, 'budgets');
    await spend(page, '60,00', 'Lebensmittel', '2026-09-15');
    await open(page, '/budgets');
    await page.getByRole('button', { name: 'Budget hinzufügen' }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('61');
    await save(page);
    await expect(page.getByTestId('forecast-line')).toContainText('Im bisherigen Tempo');

    await page
      .getByRole('button', { name: /Lebensmittel/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('budget-history')).toBeVisible();
    await expect(dialog.getByTestId('budget-history').getByRole('row')).toHaveCount(7); // header + six months
    await expect(dialog.getByRole('link', { name: 'Buchungen ansehen' })).toBeVisible();
  });

  test('the head says what is still free', async ({ page }) => {
    await enable(page, 'budgets');
    await spend(page, '1,00', 'Lebensmittel'); // also makes the default categories
    await open(page, '/budgets');
    await page.getByRole('button', { name: 'Budget hinzufügen' }).click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('120');
    await save(page);
    await expect(page.getByTestId('budgets-free')).toContainText(/119,00\s€/);
  });

  test('a goal with a planned rate says when it is reached', async ({ page }) => {
    await enable(page, 'budgets');
    await open(page, '/budgets?tab=goals&new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Wofür sparst du?').fill('Urlaub');
    await dialog.getByLabel('Zielbetrag').fill('1200');
    await moreFields(page);
    await dialog.getByLabel('Geplante Rate pro Monat').fill('100');
    await save(page);
    await expect(page.getByTestId('goal-plan')).toContainText(
      /Mit 100,00\s€ im Monat bist du im September 2027 am Ziel/,
    );
  });
});
