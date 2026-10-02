import { expect, test } from '@playwright/test';
import { mainNav, ready } from './helpers';

const phoneOnly = (name: string) => name === 'pixel-7';

test.describe('shell: sidebar, areas, favourites (desktop)', () => {
  test.beforeEach((_fixtures, info) => {
    test.skip(phoneOnly(info.project.name), 'sidebar is a desktop feature');
  });

  test('favourites above the areas; the star adds one, keeps it after a reload, and stops at five', async ({
    page,
  }) => {
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toBeVisible();
    await expect(nav.getByRole('heading', { name: 'Bereiche' })).toBeVisible();

    const add = (name: string) =>
      nav.getByRole('button', { name: `${name} zu den Favoriten hinzufügen` }).first();
    await add('Rechnungen').click();
    await expect(
      nav.getByRole('button', { name: 'Rechnungen aus den Favoriten entfernen' }).first(),
    ).toBeVisible();

    await page.reload();
    await expect(
      nav.getByRole('button', { name: 'Rechnungen aus den Favoriten entfernen' }).first(),
    ).toBeVisible();

    await add('Abos').click();
    await expect(
      nav.getByRole('button', { name: 'Abos aus den Favoriten entfernen' }).first(),
    ).toBeVisible();
    // Kalender, ToDos, Finanzen, Rechnungen, Abos = five
    await add('Erinnerungen').click();
    await expect(page.getByText('Es sind höchstens 5 Favoriten möglich.')).toBeVisible();
    await expect(add('Erinnerungen')).toBeVisible();
  });

  test('an area can be folded and the choice survives a reload', async ({ page }) => {
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Erinnerungen' })).toBeVisible();
    await nav.getByRole('button', { name: 'Planen auf- oder zuklappen' }).click();
    await expect(nav.getByRole('link', { name: 'Erinnerungen' })).toHaveCount(0);
    await page.reload();
    await expect(nav.getByRole('link', { name: 'Erinnerungen' })).toHaveCount(0);
  });

  test('an area page opens the module last used there', async ({ page }) => {
    await ready(page, '/geld');
    await expect(page).toHaveURL(/\/finance$/);
    await ready(page, '/invoices');
    await ready(page, '/geld');
    await expect(page).toHaveURL(/\/invoices$/);
  });

  test('the modules of an area are tabs above the page', async ({ page }) => {
    await ready(page, '/finance');
    const tabs = page.getByRole('navigation', { name: 'Geld: Module' });
    await expect(tabs.getByRole('link', { name: 'Finanzen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await tabs.getByRole('link', { name: 'Rechnungen' }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(tabs.getByRole('link', { name: 'Rechnungen' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('one "+ Neu" in the top bar opens quick capture; there is no FAB on the desktop', async ({
    page,
  }) => {
    await ready(page, '/');
    await expect(page.getByRole('button', { name: /Neu/ })).toBeVisible();
    await page.getByRole('button', { name: 'Neu: schnell hinzufügen' }).click();
    await expect(page.getByRole('textbox', { name: 'Was möchtest du festhalten?' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Schnell hinzufügen', exact: true })).toHaveCount(
      0,
    );
  });

  test('the sidebar can be switched to the rail in the settings and back with the handle', async ({
    page,
  }) => {
    await ready(page, '/settings');
    await page.getByLabel('Seitenleiste').selectOption('narrow');
    const nav = mainNav(page);
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Geld' })).toHaveAttribute('href', '/geld');
    await page.getByRole('button', { name: 'Seitenleiste ausklappen' }).click();
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toBeVisible();
  });

  test('below 1200 px the rail is automatic and shows areas with labels', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Planen' })).toBeVisible();
    await expect(nav.getByRole('heading', { name: 'Favoriten' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Seitenleiste ausklappen' })).toHaveCount(0);
    await nav.getByRole('link', { name: 'Geld' }).click();
    await expect(page).toHaveURL(/\/finance$/);
  });

  test('favourites can also be set in the settings (touch path)', async ({ page }) => {
    await ready(page, '/settings');
    const row = page.getByRole('switch', { name: 'Abos' });
    await expect(row).toHaveAttribute('aria-checked', 'false');
    await row.click();
    await expect(row).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('shell: phone', () => {
  test.beforeEach((_fixtures, info) => {
    test.skip(!phoneOnly(info.project.name), 'bottom navigation is a phone feature');
  });

  test('bottom navigation by area, FAB for capture, no "+ Neu" in the top bar', async ({
    page,
  }) => {
    await ready(page, '/');
    const nav = mainNav(page);
    await expect(nav.getByRole('link', { name: 'Übersicht' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Planen' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Geld' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schnell hinzufügen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Neu: schnell hinzufügen' })).toBeHidden();

    await nav.getByRole('link', { name: 'Geld' }).click();
    await expect(page).toHaveURL(/\/finance$/);
    await expect(nav.getByRole('link', { name: 'Geld' })).toHaveAttribute('aria-current', 'page');
  });

  test('"Mehr" reaches tools, library and settings', async ({ page }) => {
    await ready(page, '/');
    await mainNav(page).getByRole('button', { name: 'Mehr' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mehr' });
    await expect(sheet.getByRole('button', { name: 'Werkzeuge' })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Modul-Bibliothek' })).toBeVisible();
    await sheet.getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL(/\/settings$/);
  });
});
