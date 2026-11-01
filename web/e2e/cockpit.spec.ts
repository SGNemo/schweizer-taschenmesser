import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mainNav, ready, showAllWidgets } from './helpers';

/** One open ToDo so the "Offene ToDos" widget has something to tick. */
async function addTodo(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
}

const grid = (page: Page) => page.getByTestId('cockpit-grid');

test.describe('Cockpit mode', () => {
  test.beforeEach(async ({ page }) => {
    await showAllWidgets(page);
  });

  test('enters from the overview button, hides the shell, leaves with Esc and the bar button', async ({
    page,
  }) => {
    await ready(page, '/');
    await expect(mainNav(page)).toBeVisible();
    await page.getByTestId('cockpit-enter').click();
    await expect(grid(page)).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);
    await expect(page.locator('main h1')).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Esc oder F10' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(grid(page)).toHaveCount(0);
    await expect(mainNav(page)).toBeVisible();

    await page.getByTestId('cockpit-enter').click();
    await page.getByRole('button', { name: 'Leiste anzeigen' }).click();
    await expect(page.getByTestId('cockpit-bar')).toHaveAttribute('data-open', 'true');
    await page.getByTestId('cockpit-exit').click();
    await expect(mainNav(page)).toBeVisible();
  });

  test('F10 toggles it from any page, the palette offers it, and the state survives a reload', async ({
    page,
  }) => {
    await ready(page, '/todos');
    await page.keyboard.press('F10');
    await expect(grid(page)).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.reload();
    await expect(grid(page)).toBeVisible();
    await expect(mainNav(page)).toHaveCount(0);

    await page.keyboard.press('F10');
    await expect(grid(page)).toHaveCount(0);

    await page.keyboard.press('Control+k');
    await page.getByRole('combobox').fill('Cockpit');
    await page.getByRole('option', { name: 'Cockpit', exact: true }).click();
    await expect(grid(page)).toBeVisible();
  });

  test('widgets stay interactive; a widget title opens the module in a panel on top', async ({
    page,
  }) => {
    await addTodo(page, 'Kaffee kaufen');
    await ready(page, '/');
    await page.getByTestId('cockpit-enter').click();
    const widget = page.getByTestId('widget-todos:open');
    await expect(widget).toContainText('Kaffee kaufen');
    await widget.getByLabel('Kaffee kaufen').click();
    const toast = page.getByRole('status').filter({ hasText: 'Erledigt' });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(widget).toContainText('Kaffee kaufen');

    await widget.getByRole('link', { name: 'Offene ToDos' }).click();
    await expect(page).toHaveURL(/\/todos$/);
    const panel = page.getByTestId('cockpit-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(grid(page)).toBeVisible(); // the cockpit stays behind the panel
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expect(grid(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(mainNav(page)).toBeVisible();
  });

  test('has its own layout: a size and the large display chosen in the cockpit leave the overview alone', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.getByTestId('cockpit-enter').click();
    await page.getByRole('button', { name: 'Leiste anzeigen' }).click();
    await page.getByRole('button', { name: 'Cockpit anpassen' }).click();
    await expect(page.getByTestId('cockpit-edit-tools')).toBeVisible();
    const size = page.getByRole('group', { name: 'Größe von Offene ToDos' });
    await size.getByRole('button', { name: 'L', exact: true }).click();
    await expect(size.getByRole('button', { name: 'L', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Karten', exact: true }).click();
    await page.getByRole('switch', { name: 'Großanzeige' }).click();
    await page.getByRole('switch', { name: 'Dichtes Raster' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('cockpit-stats')).toBeVisible();
    await expect(page.getByTestId('cockpit-stats')).toContainText('Nächster Termin');

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Anpassen' }).click();
    await expect(
      page
        .getByRole('group', { name: 'Größe von Offene ToDos' })
        .getByRole('button', { name: 'L', exact: true }),
    ).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('cockpit-stats')).toHaveCount(0);
  });

  test('passes axe in both themes', async ({ page }) => {
    await addTodo(page, 'Alt');
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page, '/');
      await page.getByTestId('cockpit-enter').click();
      await expect(grid(page)).toBeVisible();
      await page.getByRole('button', { name: 'Leiste anzeigen' }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map((v) => `${v.id}: ${v.help}`),
        scheme,
      ).toEqual([]);
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Cockpit on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

  test('no bottom bar; the grip opens the mini bar; back closes the panel', async ({ page }) => {
    await showAllWidgets(page);
    await ready(page, '/');
    await page.getByTestId('cockpit-enter').click();
    await expect(grid(page)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Leiste anzeigen' }).tap();
    await expect(page.getByTestId('cockpit-bar')).toHaveAttribute('data-open', 'true');
    await page.getByTestId('widget-todos:open').getByRole('link', { name: 'Offene ToDos' }).tap();
    await expect(page.getByTestId('cockpit-panel')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('cockpit-panel')).toHaveCount(0);
    await expect(grid(page)).toBeVisible();
  });
});
