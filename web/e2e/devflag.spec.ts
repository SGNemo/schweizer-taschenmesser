import { expect, test } from '@playwright/test';
import { ready } from './helpers';

// The regular E2E build is a stable build: the Dev-Preview tooling must not be reachable.
test('stable build has no developer section and no test-data command', async ({ page }) => {
  await ready(page, '/settings');
  await expect(page.getByRole('heading', { name: 'Entwickler' })).toHaveCount(0);
  await expect(page.getByTestId('seed-load')).toHaveCount(0);
  await expect(page.getByTestId('dev-badge')).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await page
    .getByRole('combobox', { name: 'Suchen, springen oder fragen …' })
    .fill('Testdaten laden');
  await expect(page.getByRole('option', { name: 'Testdaten laden', exact: true })).toHaveCount(0);
  // An empty stable app is never filled by itself.
  await ready(page, '/');
  await expect(page.getByTestId('seed-banner')).toHaveCount(0);
});
