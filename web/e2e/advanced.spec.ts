import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/** Basis / Erweitert view (docs/product/comfort): rare fields behind "Mehr Felder" or the module switch. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

test('Basis hides the rare fields; "Mehr Felder" reveals them for this dialog only', async ({
  page,
}) => {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Titel')).toBeVisible();
  await expect(dialog.getByLabel('Ende (Datum)')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Weitere Felder anzeigen' }).click();
  await expect(dialog.getByLabel('Ende (Datum)')).toBeVisible();
  await expect(dialog.getByLabel('Wiederholung')).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  // the next dialog starts in Basis again
  await ready(page, '/calendar?new=1');
  await expect(page.getByRole('dialog').getByLabel('Ende (Datum)')).toHaveCount(0);
});

test('the module switch "Erweitert" is remembered and shows the fields right away', async ({
  page,
}) => {
  await ready(page, '/calendar');
  await page.getByRole('switch', { name: 'Erweitert' }).click();
  await ready(page, '/calendar?new=1');
  await expect(page.getByRole('dialog').getByLabel('Ende (Datum)')).toBeVisible();
  // another module is unaffected
  await ready(page, '/todos?new=1');
  await expect(page.getByRole('switch', { name: 'Erweitert' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

test('the global setting switches every module; a module switch overrides it', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  const all = page.getByRole('switch', { name: 'Alle Module in der Erweitert-Ansicht' });
  await all.click();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await ready(page, '/todos');
  await expect(page.getByRole('switch', { name: 'Erweitert' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('switch', { name: 'Erweitert' }).click();
  await expect(page.getByRole('switch', { name: 'Erweitert' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await ready(page, '/invoices');
  await expect(page.getByRole('switch', { name: 'Erweitert' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});

test('a field that holds data is never hidden', async ({ page }) => {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Konferenz');
  await dialog.getByRole('button', { name: 'Weitere Felder anzeigen' }).click();
  await dialog.getByLabel('Ende (Datum)').fill('2026-10-01');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);
  await ready(page, '/calendar?view=day&date=2026-09-29');
  await page
    .getByRole('button', { name: /Konferenz/ })
    .first()
    .click();
  await expect(page.getByRole('dialog').getByLabel('Ende (Datum)')).toHaveValue('2026-10-01');
});
