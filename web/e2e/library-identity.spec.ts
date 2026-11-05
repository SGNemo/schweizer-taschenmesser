import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';

test.describe('libraries in identity v3', () => {
  test('the module library has a head with figures, a toolbar and cards in the modules colours', async ({
    page,
  }, info) => {
    await ready(page, '/library');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText('Modul-Bibliothek');
    // Library bands are neutral (identity v3.1, C28).
    await expect(page.getByTestId('library-head')).toHaveAttribute('data-hue', 'slate');
    await expect(page.getByTestId('library-figures')).toContainText('verfügbar');
    const card = page.getByTestId('module-todos');
    await expect(card).toHaveAttribute('data-hue', /.+/);
    // the drawn sketch sits on every card; on the phone it is hidden (the detail page keeps it large)
    await expect(card.getByTestId('widget-miniature')).toBeAttached();
    if (!isPhone(info)) await expect(card.getByTestId('widget-miniature')).toBeVisible();
    else await expect(card.getByTestId('widget-miniature')).toBeHidden();
    // section count: "n von m aktiv" under the area name
    await expect(page.getByRole('heading', { name: /^Planen/ })).toContainText('aktiv');
  });

  test('the filter and the area select narrow the list; the search still works with them', async ({
    page,
  }) => {
    await ready(page, '/library');
    await page
      .getByRole('group', { name: 'Anzeigen' })
      .getByRole('button', { name: 'Aus' })
      .click();
    await expect(page.getByTestId('module-todos')).toHaveCount(0);
    await page
      .getByRole('group', { name: 'Anzeigen' })
      .getByRole('button', { name: 'Alle' })
      .click();
    await expect(page.getByTestId('module-todos')).toBeVisible();
    await page.getByRole('combobox', { name: 'Bereich' }).selectOption({ label: 'Geld' });
    await expect(page.getByTestId('module-todos')).toHaveCount(0);
    await expect(page.getByTestId('module-finance')).toBeVisible();
  });

  test('Details opens the module page, which has the same switch, and the way back works', async ({
    page,
  }) => {
    await ready(page, '/library');
    await page
      .getByTestId('module-todos')
      .getByRole('link', { name: /Details zu ToDos/ })
      .click();
    await expect(page).toHaveURL(/\/library\/todos$/);
    await expect(page.locator('main h1')).toHaveText('ToDos');
    await expect(page.getByTestId('library-detail-head')).toHaveAttribute('data-hue', 'moss');
    await expect(page.getByRole('switch', { name: 'ToDos einschalten' })).toBeEnabled();
    await page.getByRole('link', { name: 'Alle Module' }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test('an unknown module page keeps one h1 and a way back', async ({ page }) => {
    await ready(page, '/library/doesnotexist');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Alle Module' })).toBeVisible();
  });

  test('the switch on the detail page turns a module off and on (as on the card)', async ({
    page,
  }) => {
    await ready(page, '/library/habits');
    const sw = page.getByRole('switch', { name: 'Gewohnheiten einschalten' });
    await expect(sw).toBeEnabled();
    const was = await sw.isChecked();
    await sw.click();
    // an empty module is switched off without a dialog; switching on works the same way
    await expect(sw).toBeChecked({ checked: !was });
    await sw.click();
    await expect(sw).toBeChecked({ checked: was });
  });

  test('the tool library has the same head, figures and tinted groups', async ({ page }) => {
    await ready(page, '/tools');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.getByTestId('tools-head')).toHaveAttribute('data-hue', 'slate');
    await expect(page.getByTestId('tools-figures')).toContainText('verfügbar');
    await expect(page.getByTestId('tool-calc')).toHaveAttribute('data-hue', /.+/);
  });

  test('phone: the first card shows its switch above the bottom navigation', async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), 'phone only');
    await ready(page, '/library');
    const card = page.locator('[data-testid^="module-"]').first();
    const box = await card.getByRole('switch').boundingBox();
    const nav = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
    expect(box, 'switch').not.toBeNull();
    expect(nav, 'bottom navigation').not.toBeNull();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(nav?.y ?? 0);
  });

  test('phone: the library fits and its cards stay one column', async ({ page }, info) => {
    test.skip(!isPhone(info), 'phone only');
    for (const path of ['/library', '/library/todos', '/tools']) {
      await ready(page, path);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, path).toBeLessThanOrEqual(0);
    }
  });
});
