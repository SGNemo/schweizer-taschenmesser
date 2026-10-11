import { expect, test } from '@playwright/test';
import { enableExample, ready } from './helpers';

test('safe mode starts with every module off and says so; a normal start brings them back', async ({
  page,
}) => {
  await ready(page, '/');
  await enableExample(page);
  await page.goto('/example?safe=1');
  await expect(page.getByTestId('safe-mode-banner')).toBeVisible();
  // example is off in safe mode: its route leads away from the module
  await expect(page).not.toHaveURL(/\/example/);
  await page.goto('/example');
  await expect(page.getByTestId('safe-mode-banner')).toHaveCount(0);
  await expect(page).toHaveURL(/\/example/);
});
