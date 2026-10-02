import { expect, test } from '@playwright/test';

/** Retired modules (Nachrichten, Habits, Zeiterfassung): gone from the UI, old paths lead home. */

test('old paths of retired modules lead to the home screen', async ({ page }) => {
  for (const path of ['/news', '/habits', '/timetrack', '/habits?new=1']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main h1')).toBeVisible();
  }
});

test('the library does not list retired modules', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('main h1')).toBeVisible();
  for (const id of ['news', 'habits', 'timetrack'])
    await expect(page.getByTestId(`module-${id}`)).toHaveCount(0);
  await expect(page.getByTestId('module-todos')).toBeVisible();
});
