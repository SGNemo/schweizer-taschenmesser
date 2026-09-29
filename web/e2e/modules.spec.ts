import { expect, test } from '@playwright/test';
import { enableExample, mainNav } from './helpers';

test.describe('module library', () => {
  test('fresh install has the core modules active with their widgets', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
    await expect(page.getByTestId('widget-calendar:today')).toBeVisible();
    await expect(page.getByTestId('widget-todos:open')).toBeVisible();
    await expect(page.getByTestId('widget-reminders:next')).toBeVisible();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await expect(page.getByTestId('widget-invoices:due')).toBeVisible();
    await expect(page.getByTestId('widget-subscriptions:next')).toBeVisible();
    await page.goto('/library');
    for (const id of ['calendar', 'todos', 'reminders', 'finance', 'invoices', 'subscriptions']) {
      await expect(
        page.getByTestId(`module-${id}`).getByText('Aktiv', { exact: true }),
      ).toBeVisible();
    }
    await expect(page.getByTestId('module-example')).toContainText('Referenzmodul');
  });

  test('disabling every module shows the empty dashboard and leads to the library', async ({
    page,
  }) => {
    await page.goto('/library');
    for (const id of ['calendar', 'todos', 'reminders', 'finance', 'invoices', 'subscriptions']) {
      const card = page.getByTestId(`module-${id}`);
      await card.getByRole('button', { name: 'Deaktivieren' }).click();
      await page.getByRole('button', { name: 'Daten behalten (ausgeblendet)' }).click();
      await expect(card.getByRole('button', { name: 'Aktivieren' })).toBeVisible();
    }
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Noch keine Module aktiv' })).toBeVisible();
    await page.getByRole('link', { name: 'Zur Bibliothek' }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test('enabling adds navigation, disabling removes it', async ({ page }) => {
    await page.goto('/library');
    await expect(mainNav(page).getByRole('link', { name: 'Beispiel' })).toHaveCount(0);

    await enableExample(page);
    await expect(mainNav(page).getByRole('link', { name: 'Beispiel' })).toBeVisible();

    const card = page.getByTestId('module-example');
    await card.getByRole('button', { name: 'Deaktivieren' }).click();
    await page.getByRole('button', { name: 'Daten behalten (ausgeblendet)' }).click();
    await expect(card.getByRole('button', { name: 'Aktivieren' })).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: 'Beispiel' })).toHaveCount(0);
  });

  test('a disabled module route redirects to the library', async ({ page }) => {
    await page.goto('/example');
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByText('Dieses Modul ist nicht aktiv.')).toBeVisible();
  });
});

test.describe('entries (local-first data)', () => {
  test('create, complete, persist across reload, delete', async ({ page }) => {
    await enableExample(page);
    await mainNav(page).getByRole('link', { name: 'Beispiel' }).click();
    await expect(page).toHaveURL(/\/example$/);

    await page.getByRole('textbox', { name: 'Hinzufügen' }).fill('Milch kaufen');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByText('Milch kaufen')).toBeVisible();

    // State flows through IndexedDB + live query, so assert instead of using .check().
    await page.getByRole('checkbox', { name: 'Milch kaufen' }).click();
    await expect(page.getByRole('checkbox', { name: 'Milch kaufen' })).toBeChecked();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Milch kaufen' })).toBeChecked();

    await page.getByRole('button', { name: 'Löschen' }).click();
    await expect(page.getByText('Milch kaufen')).toHaveCount(0);
    await expect(page.getByText('Noch keine Einträge.')).toBeVisible();
  });

  test('data survives disable/enable with "keep" and is wiped with "delete"', async ({ page }) => {
    await enableExample(page);
    await page.goto('/example');
    await page.getByRole('textbox', { name: 'Hinzufügen' }).fill('Bleibt');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByText('Bleibt')).toBeVisible();

    await page.goto('/library');
    const card = page.getByTestId('module-example');
    await card.getByRole('button', { name: 'Deaktivieren' }).click();
    await page.getByRole('button', { name: 'Daten behalten (ausgeblendet)' }).click();
    await card.getByRole('button', { name: 'Aktivieren' }).click();
    // Let the write reach IndexedDB before navigating away.
    await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
    await page.goto('/example');
    await expect(page.getByText('Bleibt')).toBeVisible();

    await page.goto('/library');
    await card.getByRole('button', { name: 'Deaktivieren' }).click();
    await page.getByRole('button', { name: 'Daten löschen' }).click();
    await card.getByRole('button', { name: 'Aktivieren' }).click();
    // Let the write reach IndexedDB before navigating away.
    await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
    await page.goto('/example');
    await expect(page.getByText('Noch keine Einträge.')).toBeVisible();
  });

  test('quick add opens the module create form', async ({ page }) => {
    await enableExample(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
    await page.getByRole('link', { name: 'Beispiel: neuer Eintrag' }).click();
    await expect(page).toHaveURL(/\/example/);
    await expect(page.getByRole('textbox', { name: 'Hinzufügen' })).toBeFocused();
  });
});

test.describe('shell', () => {
  test('uses sidebar on desktop and bottom navigation on phones', async ({ page }, info) => {
    await page.goto('/');
    const nav = mainNav(page);
    await expect(nav).toHaveCount(1); // exactly one is visible
    const box = await nav.boundingBox();
    if (info.project.name === 'pixel-7') {
      expect(box!.y).toBeGreaterThan(400); // bottom bar
    } else {
      expect(box!.x).toBeLessThan(50); // left sidebar
    }
  });

  test('command palette navigates', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Suchen' }).click();
    await page.getByRole('combobox').fill('einst');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('Ctrl+K opens the palette on desktop', async ({ page }, info) => {
    test.skip(info.project.name === 'pixel-7', 'keyboard shortcut is a desktop feature');
    await page.goto('/');
    // The shortcut is registered once the shell has mounted.
    await expect(page.getByRole('heading', { name: 'Übersicht', level: 1 })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('theme choice is applied and remembered', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('Farbschema').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('module settings appear for active modules and persist', async ({ page }) => {
    await enableExample(page);
    await page.goto('/settings');
    const toggle = page.getByRole('switch', { name: 'Erledigte anzeigen' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    // Wait until the write went through IndexedDB and the live query reflects it.
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Erledigte anzeigen' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});
