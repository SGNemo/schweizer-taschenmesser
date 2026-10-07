import { expect, test } from '@playwright/test';
import { enable } from './helpers';

/** Modules that were retired and later removed: old paths still lead somewhere useful. */

test('old paths of removed modules lead to the home screen', async ({ page }) => {
  for (const path of ['/news', '/habits', '/timetrack', '/habits?new=1']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main h1')).toBeVisible();
  }
});

test('old paths of merged modules lead to their successors', async ({ page }) => {
  // A route of a module that is switched off leads to the library, so switch the successors on.
  for (const id of ['lists', 'bookmarks', 'vault', 'people']) await enable(page, id);
  const successors: [string, RegExp][] = [
    ['/shopping', /\/lists$/],
    ['/packing', /\/lists$/],
    ['/launcher', /\/bookmarks\?view=links$/],
    ['/contracts', /\/vault$/],
    ['/birthdays', /\/people$/],
    ['/gifts', /\/people$/],
    ['/reminders', /\/calendar\?tab=reminders$/],
  ];
  for (const [path, target] of successors) {
    await page.goto(path);
    await expect(page, path).toHaveURL(target);
    await expect(page.locator('main h1')).toBeVisible();
  }
});

test('the library does not list removed modules', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('main h1')).toBeVisible();
  for (const id of [
    'news',
    'habits',
    'timetrack',
    'shopping',
    'packing',
    'launcher',
    'contracts',
    'birthdays',
    'gifts',
    'reminders',
  ])
    await expect(page.getByTestId(`module-${id}`)).toHaveCount(0);
  await expect(page.getByTestId('module-todos')).toBeVisible();
});
