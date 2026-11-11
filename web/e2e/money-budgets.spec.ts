import { expect, test, type Page } from '@playwright/test';
import { backSettled, enable, moreFields, openMoreFocus, showAllWidgets } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time (day 29 of 30, third quarter). */
test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function open(page: Page, url: string) {
  // A closed dialog pops its history entry with a late `history.back()`; a `goto` before that has run is
  // undone by it (ERR_ABORTED, or the old page stays and its h1 passes the check below).
  await backSettled(page);
  await page.goto(url);
  await expect(page).toHaveURL((u) => u.pathname === new URL(url, u).pathname);
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
  await moreFields(page);
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
    await page
      .getByRole('button', { name: /Budget (hinzufügen|eintragen)/ })
      .first() // the head's action (the phone's plus) and, while the list is empty, the empty state's one verb
      .click();
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
    await page
      .getByRole('button', { name: /Budget (hinzufügen|eintragen)/ })
      .first() // the head's action (the phone's plus) and, while the list is empty, the empty state's one verb
      .click();
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
    await page
      .getByRole('button', { name: /Budget (hinzufügen|eintragen)/ })
      .first() // the head's action (the phone's plus) and, while the list is empty, the empty state's one verb
      .click();
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

    // The link opens the bookings of that category: the filter is open and set.
    await dialog.getByRole('link', { name: 'Buchungen ansehen' }).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByLabel('Kategorie', { exact: true })).toHaveValue(/.+/);
    await expect(page.getByRole('button', { name: 'Filter zurücksetzen' })).toBeVisible();
  });

  test('the head says what is still free', async ({ page }) => {
    await enable(page, 'budgets');
    await spend(page, '1,00', 'Lebensmittel'); // also makes the default categories
    await open(page, '/budgets');
    await page
      .getByRole('button', { name: /Budget (hinzufügen|eintragen)/ })
      .first() // the head's action (the phone's plus) and, while the list is empty, the empty state's one verb
      .click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('120');
    await save(page);
    await expect(page.getByTestId('budgets-free')).toContainText(/119,00\s€/);
    // Month navigation grouped like Finanzen (‹ month › side by side); no chips repeating the cards (round 6, U44).
    const prev = (await page.getByRole('button', { name: 'Vorheriger Monat' }).boundingBox())!;
    const next = (await page.getByRole('button', { name: 'Nächster Monat' }).boundingBox())!;
    expect(next.x - (prev.x + prev.width)).toBeLessThan(260);
    await expect(page.getByTestId('budget-chips')).toHaveCount(0);
  });

  // Identity 4.0 (package 0b-2): the free amount is the one figure of the head's title row; with "Werte ausblenden"
  // it is hidden there too (the promise itself: e2e/hide-values.spec.ts).
  test('the figure in the head is hidden with "Werte ausblenden"', async ({ page }) => {
    await enable(page, 'budgets');
    await spend(page, '1,00', 'Lebensmittel');
    await open(page, '/budgets');
    await page
      .getByRole('button', { name: /Budget (hinzufügen|eintragen)/ })
      .first() // the head's action (the phone's plus) and, while the list is empty, the empty state's one verb
      .click();
    const editor = page.getByRole('dialog');
    await editor.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
    await editor.getByLabel('Limit pro Monat').fill('120');
    await save(page);
    const row = page.getByTestId('module-title-row');
    await expect(row.getByTestId('budgets-free')).toContainText(/119,00\s€/);
    await open(page, '/settings/barrierefreiheit');
    await openMoreFocus(page);
    const toggle = page.getByRole('switch', { name: 'Werte ausblenden' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await open(page, '/budgets');
    await expect(row.getByTestId('budgets-free').getByTestId('sensitive-value')).toBeVisible();
    await expect(row).not.toContainText(/119,00/);
    expect(await page.getByTestId('module-frame').ariaSnapshot()).not.toMatch(/119,00/);
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

  test('a goal with a start date shows what is put aside per month on average', async ({
    page,
  }) => {
    await enable(page, 'budgets');
    await open(page, '/budgets?tab=goals&new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Wofür sparst du?').fill('Fahrrad');
    await dialog.getByLabel('Zielbetrag').fill('1200');
    await moreFields(page);
    await dialog.getByLabel('Gespart seit').fill('2026-06-29');
    await save(page);
    await expect(page.getByTestId('goal-pace')).toHaveCount(0); // nothing saved yet

    await page.getByRole('button', { name: 'Einzahlen' }).click();
    const deposit = page.getByRole('dialog');
    await deposit.getByLabel('Betrag').fill('300');
    await save(page);
    // 3 months since the start: 300 / 3 = 100 a month; at that pace 900 more takes 9 months.
    await expect(page.getByTestId('goal-pace')).toContainText(
      /Bisher legst du im Schnitt 100,00\s€ pro Monat zurück/,
    );
    await expect(page.getByTestId('goal-pace')).toContainText('im Juni 2027 am Ziel');
  });
});
