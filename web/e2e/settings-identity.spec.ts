import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';
const categoryNav = (page: Page) =>
  page.getByRole('navigation', { name: 'Einstellungs-Kategorien' });

test.describe('settings in identity v3', () => {
  test('the landing page has a status head with six states and one h1', async ({ page }) => {
    await ready(page, '/settings');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveText('Einstellungen');
    const head = page.getByTestId('settings-head');
    await expect(head).toHaveAttribute('data-hue', 'slate');
    const tiles = page.getByTestId('settings-status').getByRole('link');
    await expect(tiles).toHaveCount(6);
    // every tile names its state and says what it means
    await expect(page.getByTestId('overview-backup')).toContainText('Backup');
    await page.getByTestId('overview-sync').click();
    await expect(page).toHaveURL(/\/settings\/sync$/);
  });

  test('a category page has its own head in the category hue', async ({ page }) => {
    await ready(page, '/settings/allgemein');
    await expect(page.locator('main h1')).toHaveText('Allgemein');
    await expect(page.getByTestId('settings-head-allgemein')).toHaveAttribute('data-hue', 'slate');
    await ready(page, '/settings/darstellung');
    await expect(page.getByTestId('settings-head-darstellung')).toHaveAttribute(
      'data-hue',
      'orchid',
    );
  });

  test('a module settings page carries the identity of the module', async ({ page }) => {
    await ready(page, '/settings/module/todos');
    const head = page.getByTestId('module-settings-head');
    await expect(head).toHaveAttribute('data-hue', 'moss');
    await expect(head).toHaveAttribute('data-area', 'plan');
    await expect(page.locator('main h1')).toHaveText('ToDos');
  });

  test('an unknown category or module keeps one h1 and no status tiles over "not found"', async ({
    page,
  }) => {
    for (const path of ['/settings/xyz', '/settings/module/doesnotexist']) {
      await ready(page, path);
      await expect(page.locator('main h1'), path).toHaveCount(1);
      await expect(page.locator('main h1'), path).toHaveText('Einstellungen');
      await expect(page.getByTestId('settings-status'), path).toHaveCount(0);
    }
  });

  test('the head sits in the same place on a category and on a module page', async ({
    page,
  }, info) => {
    test.skip(isPhone(info), 'desktop layout');
    await ready(page, '/settings/darstellung');
    const category = await page.getByTestId('settings-head-darstellung').boundingBox();
    await ready(page, '/settings/module/todos');
    const module = await page.getByTestId('module-settings-head').boundingBox();
    expect(Math.abs((module?.y ?? -1) - (category?.y ?? -2))).toBeLessThanOrEqual(1);
  });

  test('desktop: the category list is grouped, keyboard reachable and marks the open page', async ({
    page,
  }, info) => {
    test.skip(isPhone(info), 'the grouped column is the desktop navigation');
    await ready(page, '/settings/sync');
    const nav = categoryNav(page);
    await expect(nav.getByText('Daten und Schutz')).toBeVisible();
    await expect(nav.getByRole('link', { name: /Sync/ })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Allgemein' }).focus();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('link', { name: 'Darstellung' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings\/darstellung$/);
  });

  test('a changed setting shows the quiet dot in the list, with words for assistive tech', async ({
    page,
  }, info) => {
    test.skip(isPhone(info), 'desktop navigation');
    await ready(page, '/settings/darstellung');
    await expect(page.getByTestId('differs-darstellung')).toHaveCount(0);
    await page.evaluate(() => localStorage.setItem('tm-density', 'compact'));
    await page.reload();
    const dot = page.getByTestId('differs-darstellung');
    await expect(dot).toBeVisible();
    // the dot has a real colour (an undefined token would paint it transparent)
    await expect
      .poll(() => dot.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    await expect(categoryNav(page).getByTestId('differs-legend')).toContainText(
      'Weicht vom Standard ab',
    );
  });

  test('phone: two levels, the list first and the category with its head and a way back', async ({
    page,
  }, info) => {
    test.skip(!isPhone(info), 'phone only');
    await ready(page, '/settings');
    await expect(categoryNav(page).getByText('Daten und Schutz')).toBeVisible();
    await categoryNav(page)
      .getByRole('link', { name: /^Darstellung/ })
      .click();
    await expect(page).toHaveURL(/\/settings\/darstellung$/);
    await expect(page.locator('main h1')).toHaveText('Darstellung');
    await page.getByRole('link', { name: 'Einstellungen' }).first().click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('no horizontal overflow at the phone width', async ({ page }) => {
    for (const path of ['/settings', '/settings/darstellung', '/settings/module/todos']) {
      await ready(page, path);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(over, path).toBeLessThanOrEqual(0);
    }
  });
});
