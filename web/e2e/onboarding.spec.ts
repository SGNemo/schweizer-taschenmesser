import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

test('start-data wizard: paste lines → preview → import → undo', async ({ page }) => {
  await ready(page, '/todos');
  await expect(page.getByText('Nichts zu tun – gut so.')).toBeVisible();

  await page.getByRole('button', { name: 'Startdaten einrichten' }).click();
  const dialog = page.getByRole('dialog', { name: /Startdaten/ });
  await dialog.getByRole('button', { name: /Aufgaben einfügen/ }).click();
  await dialog
    .getByLabel('Eine Zeile = ein Eintrag')
    .fill('Steuerunterlagen sortieren\nZahnarzt anrufen\nFahrrad reparieren');
  await dialog.getByRole('button', { name: 'Vorschau anzeigen' }).click();

  // Nothing is stored before the preview is confirmed.
  await expect(dialog.getByText('3 Einträge erkannt')).toBeVisible();
  await dialog.getByRole('checkbox', { name: /Fahrrad reparieren/ }).click();
  await expect(dialog.getByRole('checkbox', { name: /Fahrrad reparieren/ })).not.toBeChecked();
  await dialog.getByRole('button', { name: '2 Einträge importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('2 Einträge wurden importiert.');

  await dialog.getByRole('button', { name: 'Schließen' }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Zahnarzt anrufen' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Fahrrad reparieren' })).toHaveCount(0);

  // The batch stays undoable from the "recently imported" list.
  await page.goto('/settings');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'ToDos' })
    .getByRole('button', { name: 'Startdaten einrichten' })
    .click();
  const again = page.getByRole('dialog', { name: /Startdaten/ });
  await again.getByRole('button', { name: 'Import rückgängig machen' }).click();
  await expect(again.getByText('rückgängig gemacht')).toBeVisible();
  await page.goto('/todos');
  await expect(page.getByRole('checkbox', { name: 'Zahnarzt anrufen' })).toHaveCount(0);
});
