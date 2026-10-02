import { expect, test } from '@playwright/test';
import { enable, mainNav, ready } from './helpers';

const CORE = [
  'calendar:today',
  'todos:open',
  'reminders:next',
  'finance:balance',
  'invoices:due',
  'subscriptions:next',
];

test.describe('Home screen', () => {
  test('is the start route; the logo leads back from any module', async ({ page }) => {
    await ready(page, '/');
    await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
    await ready(page, '/todos');
    await page.getByRole('link', { name: 'Zur Übersicht' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
  });

  test('navigation separates the home entry from the module list', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'the labelled module list is the desktop sidebar');
    await ready(page, '/todos');
    await expect(page.getByRole('heading', { name: 'Bereiche', exact: true })).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: 'Übersicht' })).toBeVisible();
  });

  test('Alt+Home goes to the home screen', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
    await ready(page, '/todos');
    await page.keyboard.press('Alt+Home');
    await expect(page).toHaveURL(/\/$/);
  });

  test('every active module has a widget; the vault widget shows status only', async ({ page }) => {
    await enable(page, 'accounts');
    await ready(page, '/');
    for (const key of CORE) await expect(page.getByTestId(`widget-${key}`)).toBeVisible();
    const vault = page.getByTestId('widget-accounts:status');
    await expect(vault).toContainText('Noch nicht eingerichtet');
    await expect(vault.getByRole('link', { name: 'Tresor einrichten' })).toBeVisible();
  });

  test('empty widgets offer a next step', async ({ page }) => {
    await ready(page, '/');
    await expect(
      page.getByTestId('widget-todos:open').getByRole('link', { name: 'Aufgabe anlegen' }),
    ).toBeVisible();
  });

  test('edit mode: size, hide via the widget list, show again, reset', async ({ page }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: 'Anpassen' }).click();

    const size = page.getByRole('group', { name: 'Größe von Nächste Erinnerungen' });
    await size.getByRole('button', { name: 'L', exact: true }).click();
    await expect(size.getByRole('button', { name: 'L', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Widgets', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Widgets der Übersicht' });
    await expect(sheet).toContainText('Ausblenden betrifft nur die Übersicht');
    const todos = sheet.getByRole('switch', { name: 'Offene ToDos' });
    await todos.click();
    await expect(todos).toHaveAttribute('aria-checked', 'false');
    await sheet.getByRole('button', { name: 'Schließen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('widget-todos:open')).toHaveCount(0);
    // hiding on the home screen never deactivates the module
    await page.goto('/library');
    await expect(
      page.getByTestId('module-todos').getByText('Aktiv', { exact: true }),
    ).toBeVisible();

    await page.goto('/');
    await page.getByRole('button', { name: 'Anpassen' }).click();
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    await page.getByRole('button', { name: 'Auf Standard zurücksetzen' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page
        .getByRole('group', { name: 'Größe von Nächste Erinnerungen' })
        .getByRole('button', { name: 'S', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('widget-todos:open')).toBeVisible();
    await page.getByRole('button', { name: 'Fertig' }).click();
  });
});
