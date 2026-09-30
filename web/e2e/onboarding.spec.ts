import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

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

test('JSON fallback: paste → preview with a bad entry → import → repeat is a duplicate', async ({
  page,
}) => {
  await ready(page, '/todos');
  await page.getByRole('button', { name: 'Startdaten einrichten' }).click();
  const dialog = page.getByRole('dialog', { name: /Startdaten/ });
  await dialog.getByRole('button', { name: /JSON einfügen/ }).click();
  await expect(dialog.getByRole('button', { name: 'Schema für KI kopieren' })).toBeVisible();

  const json = JSON.stringify({
    items: [
      { collection: 'task', title: 'Steuererklärung', dueDate: '2026-10-15', priority: 2 },
      { collection: 'task', title: 'Kaputtes Datum', dueDate: '15.10.2026' },
    ],
  });
  await dialog.getByLabel('JSON', { exact: true }).fill(json);
  await dialog.getByRole('button', { name: 'Vorschau anzeigen' }).click();
  await expect(dialog.getByText('2 Einträge erkannt')).toBeVisible();
  await expect(dialog.getByText('Nicht importierbar')).toBeVisible();
  await dialog.getByRole('button', { name: '1 Eintrag importieren' }).click();
  await expect(dialog.getByRole('status')).toHaveText('1 Eintrag wurde importiert.');
  await dialog.getByRole('button', { name: 'Schließen' }).last().click();
  await expect(page.getByRole('checkbox', { name: 'Steuererklärung' })).toBeVisible();

  // The same data again is recognised.
  await page.goto('/settings');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'ToDos' })
    .getByRole('button', { name: 'Startdaten einrichten' })
    .click();
  const again = page.getByRole('dialog', { name: /Startdaten/ });
  await again.getByRole('button', { name: /JSON einfügen/ }).click();
  await again.getByLabel('JSON', { exact: true }).fill(json);
  await again.getByRole('button', { name: 'Vorschau anzeigen' }).click();
  await expect(again.getByText('Schon vorhanden')).toBeVisible();
});
