import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Comfort scenarios (docs/product/comfort): the click counts of everyday actions are asserted
 * by counting the `click()` calls after the page is open. Runs on desktop and on the phone viewport.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addInvoice(page: Page, payee: string, due: string) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill(payee);
  await dialog.getByLabel('Betrag').fill('50,00');
  await dialog.getByLabel('Fällig am').fill(due);
  await save(page);
}

test('invoice paid from the home widget takes 1 click and can be undone', async ({ page }) => {
  await addInvoice(page, 'Stadtwerke', '2026-10-05');
  await ready(page, '/');
  const widget = page.getByTestId('widget-invoices:due');
  await expect(widget).toContainText('Stadtwerke');
  await widget.getByRole('button', { name: /Als bezahlt markieren: Stadtwerke/ }).click(); // click 1
  await expect(widget).not.toContainText('Stadtwerke');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(widget).toContainText('Stadtwerke');
});

test('rescheduling an appointment: open, "Morgen", save = 3 clicks', async ({ page }) => {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Zahnarzt');
  await dialog.getByLabel('Datum', { exact: true }).fill('2026-09-29');
  await save(page);

  await ready(page, '/calendar?view=day&date=2026-09-29');
  await page
    .getByRole('button', { name: /Zahnarzt/ })
    .first()
    .click(); // click 1: open
  await page.getByRole('dialog').getByRole('button', { name: 'Morgen', exact: true }).click(); // click 2
  await expect(page.getByRole('dialog').getByLabel('Datum', { exact: true })).toHaveValue(
    '2026-09-30',
  );
  await save(page); // click 3
  await ready(page, '/calendar?view=day&date=2026-09-30');
  await expect(page.getByRole('button', { name: /Zahnarzt/ }).first()).toBeVisible();
});

test('snoozing a reminder from the list: "⋯" then "In 1 Std" = 2 clicks', async ({ page }) => {
  await page.goto('/calendar?tab=reminders&new=1');
  const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
  await dialog.getByLabel('Titel').fill('Müll rausstellen');
  await dialog.getByLabel('Datum', { exact: true }).fill('2026-09-29');
  await dialog.getByLabel('Beginn').fill('10:30');
  await save(page);

  await page.getByRole('button', { name: 'Müll rausstellen: Weitere Aktionen' }).click(); // click 1
  await page.getByRole('menuitem', { name: 'In 1 Std' }).click(); // click 2
  await expect(page.getByText(/Okay, in einer Stunde/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Müll rausstellen [^:]/ })).toContainText('11:00');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Müll rausstellen [^:]/ })).toContainText('10:30');
});

test('right-click on a reminder opens the same menu', async ({ page, isMobile }) => {
  test.skip(isMobile, 'long press is the touch equivalent of the contextmenu event');
  await page.goto('/calendar?tab=reminders&new=1');
  const dialog = page.getByRole('dialog', { name: 'Erinnerung hinzufügen' });
  await dialog.getByLabel('Titel').fill('Blumen gießen');
  await dialog.getByLabel('Datum', { exact: true }).fill('2026-09-30');
  await dialog.getByLabel('Beginn').fill('08:00');
  await save(page);
  await page.getByRole('button', { name: /^Blumen gießen [^:]/ }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Löschen' })).toBeVisible();
});

test('changing the category of a booking: "⋯" then the category = 2 clicks, undoable', async ({
  page,
}) => {
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByLabel('Betrag').fill('12,00');
  await dialog.getByLabel('Kategorie').selectOption({ label: 'Mobilität' });
  await dialog.getByLabel('Empfänger / Titel').fill('Bahn');
  await save(page);

  await ready(page, '/finance?tab=transactions');
  await expect(page.getByRole('button', { name: /^Bahn / })).toContainText('Mobilität');
  await page.getByRole('button', { name: 'Bahn: Weitere Aktionen' }).click(); // click 1
  await page.getByRole('menuitem', { name: 'Freizeit' }).click(); // click 2
  await expect(page.getByRole('button', { name: /^Bahn / })).toContainText('Freizeit');
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Bahn / })).toContainText('Mobilität');
});

test('a to-do goes to tomorrow from the row menu (2 clicks) and ticking off stays 1 click', async ({
  page,
}) => {
  await ready(page, '/todos');
  await page.getByPlaceholder('Neue Aufgabe …').fill('Brot kaufen');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Brot kaufen' });
  await expect(row).toBeVisible();

  await page.getByRole('button', { name: 'Brot kaufen: Weitere Aktionen' }).click(); // click 1
  await page.getByRole('menuitem', { name: 'Morgen', exact: true }).click(); // click 2
  await expect(page.getByRole('listitem').filter({ hasText: 'Brot kaufen' })).toContainText(
    'Morgen',
  );
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Brot kaufen' })).not.toContainText(
    'Morgen',
  );

  await page.getByRole('checkbox', { name: 'Brot kaufen' }).check(); // 1 click
  await expect(page.getByText('Als erledigt markiert.')).toBeVisible();
});
