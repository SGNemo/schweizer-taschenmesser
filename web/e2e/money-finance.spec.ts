import { expect, test, type Page } from '@playwright/test';
import { moreFields, ready, showAllWidgets } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addAccount(page: Page, name: string, opening: string) {
  await ready(page, '/finance?tab=accounts');
  await page.getByRole('button', { name: 'Konto hinzufügen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kontoname').fill(name);
  await dialog.getByLabel('Anfangssaldo').fill(opening);
  await save(page);
}

test.describe('Finance: transfers, splits, year, outlook', () => {
  test('a transfer moves money between accounts and is neither income nor expense', async ({
    page,
  }) => {
    await addAccount(page, 'Sparkonto', '1000,00');

    // C23: the empty bookings page offers one verb; transfers live on "Konten".
    await ready(page, '/finance?tab=accounts');
    await page.getByRole('button', { name: 'Umbuchung', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Umbuchung' });
    await dialog.getByLabel('Von Konto').selectOption({ label: 'Girokonto' });
    await dialog.getByLabel('Auf Konto').selectOption({ label: 'Sparkonto' });
    await dialog.getByLabel('Betrag').fill('250,00');
    await save(page);

    await ready(page, '/finance?tab=accounts');
    await expect(page.getByTestId('balance-Girokonto')).toHaveText(/-250,00\s€/);
    await expect(page.getByTestId('balance-Sparkonto')).toHaveText(/1\.250,00\s€/);

    await ready(page, '/finance?tab=overview');
    await expect(page.getByTestId('kpi-expense')).toHaveText(/0,00\s€/);
    await expect(page.getByTestId('kpi-income')).toHaveText(/0,00\s€/);
  });

  test('a booking can be split over two categories', async ({ page }) => {
    await ready(page, '/finance?new=1');
    const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
    await dialog.getByLabel('Betrag').fill('50,00');
    await dialog.getByLabel('Empfänger / Titel').fill('Drogerie');
    await moreFields(page);
    await dialog.getByRole('button', { name: 'Auf mehrere Kategorien aufteilen' }).click();
    await dialog.getByLabel('Teil 1').selectOption({ label: 'Lebensmittel' });
    await dialog.getByLabel('Betrag').nth(1).fill('32,00');
    await dialog.getByLabel('Teil 2').selectOption({ label: 'Sonstiges' });
    await dialog.getByLabel('Betrag').nth(2).fill('18,00');
    await expect(dialog.getByRole('status')).toContainText('genau den Betrag');
    await save(page);

    await ready(page, '/finance?tab=transactions');
    await expect(page.getByRole('listitem').filter({ hasText: /^Drogerie/ })).toContainText(
      '2 Kategorien',
    );
    await ready(page, '/finance?tab=overview');
    await expect(page.getByTestId('kpi-expense')).toHaveText(/50,00\s€/);
  });

  test('a split that does not add up is not saved', async ({ page }) => {
    await ready(page, '/finance?new=1');
    const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
    await dialog.getByLabel('Betrag').fill('50,00');
    await moreFields(page);
    await dialog.getByRole('button', { name: 'Auf mehrere Kategorien aufteilen' }).click();
    await dialog.getByLabel('Betrag').nth(1).fill('10,00');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('zu verteilen');
  });

  test('the year view sums twelve months', async ({ page }) => {
    await ready(page, '/finance?tab=overview&period=year&year=2026');
    await expect(page.getByTestId('year-label')).toHaveText('2026');
    await expect(page.getByTestId('year-income')).toBeVisible();
    await page.getByRole('button', { name: 'Vorheriges Jahr' }).click();
    await expect(page.getByTestId('year-label')).toHaveText('2025');
  });

  test('the outlook lists a repeating booking and a horizon switch', async ({ page }) => {
    await ready(page, '/finance?new=1');
    const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
    await dialog.getByLabel('Betrag').fill('800,00');
    await dialog.getByLabel('Empfänger / Titel').fill('Miete');
    await dialog.getByLabel('Datum').fill('2026-09-01');
    await moreFields(page);
    await dialog.getByLabel('Wiederholen').selectOption({ label: 'Monatlich' });
    await save(page);

    await ready(page, '/finance?tab=overview');
    await expect(page.getByTestId('forecast-end')).toHaveCount(0); // nothing planned until month end
    // The outlook's switch and list are a power view: they appear in Erweitert.
    await page.getByRole('switch', { name: 'Mehr Felder anzeigen' }).click();
    await page.getByTestId('forecast-toggle').click();
    await page.getByRole('button', { name: '30 Tage' }).click();
    await expect(page.getByTestId('forecast-lowest')).toContainText('01.10.2026');
  });
});
