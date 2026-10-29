import { expect, test } from '@playwright/test';
import { openTodosMenu, ready } from './helpers';

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
  await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).click();
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
  const toggle = page.getByRole('switch', { name: 'Erweitert' });
  await toggle.click();
  // the choice is written asynchronously: wait for it before leaving the page
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await ready(page, '/calendar?new=1');
  await expect(page.getByRole('dialog').getByLabel('Ende (Datum)')).toBeVisible();
  // another module is unaffected
  await ready(page, '/todos?new=1');
  await expect(
    (await openTodosMenu(page)).getByRole('menuitemcheckbox', { name: 'Erweitert' }),
  ).toHaveAttribute('aria-checked', 'false');
});

test('the global setting switches every module; a module switch overrides it', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  const all = page.getByRole('switch', { name: 'Alle Module in der Erweitert-Ansicht' });
  await all.click();
  await expect(all).toHaveAttribute('aria-checked', 'true');
  await ready(page, '/todos');
  const advanced = (await openTodosMenu(page)).getByRole('menuitemcheckbox', { name: 'Erweitert' });
  await expect(advanced).toHaveAttribute('aria-checked', 'true');
  await advanced.click(); // picking an entry closes the menu
  await expect(
    (await openTodosMenu(page)).getByRole('menuitemcheckbox', { name: 'Erweitert' }),
  ).toHaveAttribute('aria-checked', 'false');
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
  await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).click();
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

test('finance: accounts and categories sit behind "Erweitert", or show once there is more than the defaults', async ({
  page,
}) => {
  await ready(page, '/finance');
  await expect(page.getByRole('button', { name: 'Buchungen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Konten' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kategorien' })).toHaveCount(0);

  const toggle = page.getByRole('switch', { name: 'Erweitert' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Konten' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kategorien' })).toBeVisible();

  // A link to the tab (e.g. from the balance widget) always works, even in Basis.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await ready(page, '/finance?tab=accounts');
  await expect(page.getByRole('button', { name: 'Konto hinzufügen' })).toBeVisible();
});
