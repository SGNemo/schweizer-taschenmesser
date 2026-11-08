import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/**
 * Printing a page (Strg+P) shows only its content: no navigation, quick-add button, top bar,
 * banners or toasts on top of the list (round 5, person B, finding B09).
 */
test('the print view shows only the page content', async ({ page }) => {
  await ready(page, '/invoices');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByTestId('sidebar')).toBeHidden();
  await expect(page.getByRole('banner')).toBeHidden();
  // Desktop: "Neu" in the top bar; phone: the bottom bar and the round "+" button.
  await expect(page.locator('[data-bottom-bar]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Schnell hinzufügen', exact: true })).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await expect(page.getByRole('banner')).toBeVisible();
});
