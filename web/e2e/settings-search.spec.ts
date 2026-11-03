import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

const box = (page: Page) => page.getByRole('search').getByPlaceholder('Einstellung suchen …');

test('a sub-group is found by its name and shows the path', async ({ page }) => {
  await ready(page, '/settings');
  await box(page).fill('verwalten');
  const hit = page
    .getByRole('search')
    .getByRole('link', { name: /Verwalten/ })
    .first();
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(page).toHaveURL(/\/settings\/allgemein#profiles$/);

  await box(page).fill('änderungsverlauf');
  await expect(
    page
      .getByRole('search')
      .getByRole('link', { name: /Allgemein › Verwalten › / })
      .first(),
  ).toBeVisible();
});

test('a quick switch can be changed inside the hit, a vault setting offers none', async ({
  page,
}) => {
  await ready(page, '/settings');
  await box(page).fill('dunkel');
  const quick = page.getByTestId('search-quick-theme');
  await expect(quick).toBeVisible();
  await quick.getByRole('button', { name: 'Dunkel', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The page stays where it is: the change needed no navigation.
  await expect(page).toHaveURL(/\/settings$/);

  await box(page).fill('tresor sperre');
  await expect(page.locator('[data-testid^="search-quick-"]')).toHaveCount(0);
});

test('a module setting is found with its page block in the path', async ({ page }) => {
  await ready(page, '/settings');
  await box(page).fill('erledigte aufgaben');
  const hit = page
    .getByRole('search')
    .getByRole('link', { name: /Erledigte Aufgaben anzeigen/ })
    .first();
  await expect(hit).toBeVisible();
  // Module › To-dos › General: the page block is part of the path.
  await expect(hit).toContainText(/ › Allgemein$/);
  await hit.click();
  await expect(page).toHaveURL(/\/settings\/module\/todos#module-todos--showDone$/);
});
