import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

/** Clicks "Speichern" and waits until the dialog is gone, i.e. the write has finished. */
async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** Live (not deleted) bookings, read straight from IndexedDB so tests can wait for async bus handlers. */
async function liveTransactionCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('finance_transaction')) return resolve(0);
          const req = db
            .transaction('finance_transaction')
            .objectStore('finance_transaction')
            .getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              (req.result as { deletedAt: number | null }[]).filter((t) => t.deletedAt === null)
                .length,
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

async function addInvoice(page: Page, payee: string, amount: string, due: string) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill(payee);
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Fällig am').fill(due);
  await save(page);
}

async function addTransaction(
  page: Page,
  o: { kind: 'Ausgabe' | 'Einnahme'; amount: string; category: string; payee?: string },
) {
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByRole('button', { name: o.kind, exact: true }).click();
  await dialog.getByLabel('Betrag').fill(o.amount);
  await dialog.getByLabel('Kategorie').selectOption({ label: o.category });
  if (o.payee) await dialog.getByLabel('Empfänger / Titel').fill(o.payee);
  await save(page);
}

test.describe('Invoices', () => {
  test('creates an invoice, shows it on dashboard and calendar', async ({ page }) => {
    await addInvoice(page, 'Stadtwerke', '89,90', '2026-10-05');
    await expect(page.getByTestId('open-total')).toHaveText(/89,90\s€/);
    await expect(page.getByRole('button', { name: /Stadtwerke/ })).toContainText('Fällig am');

    await ready(page, '/');
    await expect(page.getByTestId('widget-invoices:due')).toContainText('Stadtwerke');
    await expect(page.getByTestId('widget-invoices:due')).toContainText('1 offene Rechnung');

    await ready(page, '/calendar?view=week&date=2026-10-05');
    await expect(
      page.getByRole('button', { name: /Rechnung.*Stadtwerke · 89,90\s€/ }),
    ).toBeVisible();
  });

  test('rejects an invalid amount', async ({ page }) => {
    await ready(page, '/invoices?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Empfänger', { exact: true }).fill('X');
    await dialog.getByLabel('Betrag').fill('zwölf');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog.getByRole('alert')).toContainText('gültigen Betrag');
  });

  test('marking as paid books an expense in finance; undo removes it again', async ({ page }) => {
    await addInvoice(page, 'Stadtwerke', '89,90', '2026-10-05');
    await page.getByRole('button', { name: 'Als bezahlt markieren' }).click();
    await expect(page.getByText('Als bezahlt markiert.')).toBeVisible();
    await expect(page.getByTestId('open-total')).toHaveText(/0,00\s€/);
    // The expense is booked by an async bus handler in the finance module.
    await expect.poll(() => liveTransactionCount(page)).toBe(1);

    // Paid invoices move to the "Bezahlt" view
    await page.getByRole('button', { name: 'Bezahlt', exact: true }).click();
    await expect(page.getByRole('button', { name: /Stadtwerke/ })).toContainText(
      'Bezahlt am: 29. Sep. 2026',
    );

    // Finance shows the booking and the reduced balance
    await ready(page, '/finance?tab=transactions');
    const row = page.getByRole('button', { name: /Stadtwerke/ });
    await expect(row).toContainText('Rechnungen');
    await expect(row).toContainText(/−89,90\s€/);
    await page.getByRole('button', { name: 'Konten', exact: true }).click();
    await expect(page.getByTestId('balance-Girokonto')).toHaveText(/-89,90\s€/);

    // Reopen → expense disappears
    await ready(page, '/invoices');
    await page.getByRole('button', { name: 'Bezahlt', exact: true }).click();
    await page.getByRole('button', { name: 'Wieder öffnen' }).click();
    await expect(page.getByText('Noch keine bezahlten Rechnungen.')).toBeVisible();
    await expect.poll(() => liveTransactionCount(page)).toBe(0);
    await ready(page, '/finance?tab=transactions');
    await expect(page.getByText('Keine Buchungen in diesem Monat.')).toBeVisible();
    await page.getByRole('button', { name: 'Konten', exact: true }).click();
    await expect(page.getByTestId('balance-Girokonto')).toHaveText(/0,00\s€/);
  });

  test('the toast offers an undo right after paying', async ({ page }) => {
    await addInvoice(page, 'Vermieter', '750,00', '2026-10-01');
    await page.getByRole('button', { name: 'Als bezahlt markieren' }).click();
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByTestId('open-total')).toHaveText(/750,00\s€/);
    await expect.poll(() => liveTransactionCount(page)).toBe(0);
    await ready(page, '/finance?tab=transactions');
    await expect(page.getByText('Keine Buchungen in diesem Monat.')).toBeVisible();
  });
});

test.describe('Subscriptions', () => {
  test('totals per month and year, next charge, cancellation deadline, pausing', async ({
    page,
  }) => {
    await ready(page, '/subscriptions?new=1');
    let dialog = page.getByRole('dialog', { name: 'Abo hinzufügen' });
    await dialog.getByLabel('Name').fill('Streaming');
    await dialog.getByLabel('Betrag').fill('12,99');
    await dialog.getByLabel('Abbuchung am').fill('2026-10-15');
    await dialog.getByLabel('Kündigungsfrist (Tage vor Abbuchung)').fill('30');
    await expect(dialog.getByText('≙ 12,99')).toBeVisible();
    await save(page);

    await ready(page, '/subscriptions?new=1');
    dialog = page.getByRole('dialog', { name: 'Abo hinzufügen' });
    await dialog.getByLabel('Name').fill('Cloud');
    await dialog.getByLabel('Betrag').fill('99');
    await dialog.getByLabel('Abbuchung am').fill('2026-12-01');
    await dialog.getByLabel('Wiederholung').selectOption('yearly');
    await save(page);

    await expect(page.getByTestId('total-month')).toHaveText(/21,24\s€/);
    await expect(page.getByTestId('total-year')).toHaveText(/254,88\s€/);
    const streaming = page.getByRole('button', { name: /Streaming/ });
    await expect(streaming).toContainText('Nächste Abbuchung: 15. Okt. 2026');
    await expect(streaming).toContainText('Kündigen bis: 16. Okt. 2026');
    await expect(page.getByRole('button', { name: /Cloud/ })).toContainText('Jährlich');

    // Pausing removes it from the totals
    await page.getByRole('switch', { name: /Streaming/ }).click();
    await expect(page.getByTestId('total-month')).toHaveText(/8,25\s€/);

    await ready(page, '/');
    await expect(page.getByTestId('widget-subscriptions:next')).toContainText('Cloud');
    await expect(page.getByTestId('widget-subscriptions:next')).not.toContainText('Streaming');
  });

  test('charges and cancellation deadlines appear on the calendar', async ({ page }) => {
    await ready(page, '/subscriptions?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Fitnessstudio');
    await dialog.getByLabel('Betrag').fill('29,90');
    await dialog.getByLabel('Abbuchung am').fill('2026-10-15');
    await dialog.getByLabel('Kündigungsfrist (Tage vor Abbuchung)').fill('10');
    await save(page);

    // Charge on 15 Oct, cancellation deadline 10 days earlier (5 Oct)
    await ready(page, '/calendar?view=week&date=2026-10-15');
    await expect(page.getByRole('button', { name: /Abo.*Fitnessstudio · 29,90\s€/ })).toBeVisible();
    await ready(page, '/calendar?view=week&date=2026-10-05');
    await expect(
      page.getByRole('button', { name: /Kündigung.*Kündigungsfrist: Fitnessstudio/ }),
    ).toBeVisible();
  });
});

test.describe('Finance', () => {
  test('books income and expenses, month overview, chart and table twin', async ({ page }) => {
    await addTransaction(page, {
      kind: 'Einnahme',
      amount: '2.500,00',
      category: 'Gehalt',
      payee: 'Arbeitgeber',
    });
    await addTransaction(page, {
      kind: 'Ausgabe',
      amount: '45,50',
      category: 'Lebensmittel',
      payee: 'Supermarkt',
    });
    await addTransaction(page, {
      kind: 'Ausgabe',
      amount: '20',
      category: 'Freizeit',
      payee: 'Kino',
    });

    await ready(page, '/finance');
    await expect(page.getByTestId('month-label')).toHaveText('September 2026');
    await expect(page.getByTestId('kpi-income')).toHaveText(/2\.500,00\s€/);
    await expect(page.getByTestId('kpi-expense')).toHaveText(/65,50\s€/);
    await expect(page.getByTestId('kpi-net')).toHaveText(/2\.434,50\s€/);
    // Nothing is deducted → the hero is simply the balance
    await expect(page.getByTestId('hero')).toHaveText(/2\.434,50\s€/);
    await expect(page.getByTestId('hero-breakdown')).toHaveCount(0);

    // Charts render lazily; the table twin holds every value
    await expect(page.getByTestId('chart-categories')).toBeVisible();
    await expect(page.getByTestId('chart-trend')).toBeVisible();
    await page.getByRole('button', { name: 'Als Tabelle anzeigen' }).first().click();
    const table = page.getByTestId('table-categories');
    await expect(table.getByRole('row')).toHaveCount(3); // header + 2 categories
    await expect(table.getByRole('row').nth(1)).toContainText('Lebensmittel');
    await expect(table.getByRole('row').nth(1)).toContainText(/45,50\s€/);
    await expect(table.getByRole('row').nth(2)).toContainText('Freizeit');
    await page.getByRole('button', { name: 'Als Tabelle anzeigen' }).click();
    await expect(page.getByTestId('table-trend').getByRole('row').last()).toContainText(
      /2\.434,50\s€/,
    );

    // Previous month is empty; the filter scopes the whole page
    await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
    await expect(page.getByTestId('month-label')).toHaveText('August 2026');
    await expect(page.getByTestId('kpi-expense')).toHaveText(/0,00\s€/);
    await expect(page.getByText('Keine Ausgaben in diesem Monat.')).toBeVisible();
    await page.getByRole('button', { name: 'Aktueller Monat' }).click();
    await expect(page.getByTestId('month-label')).toHaveText('September 2026');
  });

  test('the chart shows a tooltip when a bar is hovered', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'hover is a desktop interaction');
    await addTransaction(page, { kind: 'Ausgabe', amount: '45,50', category: 'Lebensmittel' });
    await ready(page, '/finance');
    const chart = page.getByTestId('chart-categories');
    await expect(chart.locator('svg.recharts-surface')).toBeVisible();
    // Point at the row of the bar (the chart resolves the hovered category from the pointer).
    await chart.hover({ position: { x: 300, y: 24 } });
    const tip = page.getByTestId('chart-tooltip');
    await expect(tip).toContainText('Lebensmittel');
    await expect(tip).toContainText(/45,50\s€/);
  });

  test('lists, edits and deletes a booking', async ({ page }) => {
    await addTransaction(page, {
      kind: 'Ausgabe',
      amount: '12,00',
      category: 'Mobilität',
      payee: 'Bahn',
    });
    await ready(page, '/finance?tab=transactions');
    const row = page.getByRole('button', { name: /Bahn/ });
    await expect(row).toContainText(/−12,00\s€/);
    await expect(row).toContainText('Mobilität');

    await row.click();
    const dialog = page.getByRole('dialog', { name: 'Buchung bearbeiten' });
    await dialog.getByLabel('Betrag').fill('15,50');
    await save(page);
    await expect(page.getByRole('button', { name: /Bahn/ })).toContainText(/−15,50\s€/);

    await page.getByRole('button', { name: /Bahn/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Keine Buchungen in diesem Monat.')).toBeVisible();
  });

  test('accounts and categories can be managed; the balance sums all accounts', async ({
    page,
  }) => {
    await addTransaction(page, { kind: 'Einnahme', amount: '100,00', category: 'Gehalt' });
    await ready(page, '/finance?tab=accounts');
    await page.getByRole('button', { name: 'Konto hinzufügen' }).click();
    await page.getByLabel('Kontoname').fill('Sparkonto');
    await page.getByLabel('Anfangssaldo').fill('1.000,00');
    await save(page);
    await expect(page.getByTestId('balance-Sparkonto')).toHaveText(/1\.000,00\s€/);
    await expect(page.getByTestId('balance-Girokonto')).toHaveText(/100,00\s€/);

    await page.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await expect(page.getByTestId('hero')).toHaveText(/1\.100,00\s€/);

    await page.getByRole('button', { name: 'Kategorien', exact: true }).click();
    await page
      .getByRole('region', { name: 'Ausgabenkategorien' })
      .getByRole('button', { name: 'Kategorie hinzufügen' })
      .click();
    await page.getByLabel('Name').fill('Haustier');
    await save(page);
    await expect(page.getByRole('region', { name: 'Ausgabenkategorien' })).toContainText(
      'Haustier',
    );

    // Deleting an account removes it and its bookings
    await page.getByRole('button', { name: 'Konten', exact: true }).click();
    await page.getByRole('button', { name: /Girokonto/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('balance-Girokonto')).toHaveCount(0);
    await expect(page.getByTestId('balance-Sparkonto')).toBeVisible();
  });

  test('"available" deducts open invoices and subscription charges until month end', async ({
    page,
  }) => {
    await addTransaction(page, { kind: 'Einnahme', amount: '2.500,00', category: 'Gehalt' });
    await addInvoice(page, 'Zahnarzt', '320,00', '2026-10-10');
    await ready(page, '/subscriptions?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Handyvertrag');
    await dialog.getByLabel('Betrag').fill('45,99');
    await dialog.getByLabel('Abbuchung am').fill('2026-09-30'); // charged tomorrow, still this month
    await save(page);

    await ready(page, '/finance');
    await expect(page.getByTestId('hero')).toHaveText(/2\.134,01\s€/);
    const breakdown = page.getByTestId('hero-breakdown');
    await expect(breakdown).toContainText(/Kontostand 2\.500,00\s€/);
    await expect(breakdown).toContainText(/offene Rechnungen −320,00\s€/);
    await expect(breakdown).toContainText(/Abos bis Monatsende −45,99\s€/);

    // Dashboard widget shows the same numbers
    await ready(page, '/');
    await expect(page.getByTestId('widget-finance:balance')).toContainText(/2\.500,00\s€/);
    await expect(page.getByTestId('widget-finance:balance')).toContainText(/2\.134,01\s€/);

    // Switch the deduction off in the settings
    await ready(page, '/settings');
    await page
      .getByRole('switch', { name: 'Offene Rechnungen vom verfügbaren Betrag abziehen' })
      .click();
    await expect(
      page.getByRole('switch', { name: 'Offene Rechnungen vom verfügbaren Betrag abziehen' }),
    ).toHaveAttribute('aria-checked', 'false');
    await ready(page, '/finance');
    await expect(page.getByTestId('hero')).toHaveText(/2\.454,01\s€/);
  });
});
