import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

const html = (page: Page) => page.locator('html');

test('without a supporter code a theme is only a 30 second preview', async ({ page }) => {
  await page.clock.install();
  await ready(page, '/settings/darstellung');
  await expect(html(page)).not.toHaveAttribute('data-palette', /.+/);

  // Locked tiles say so, and a click tries the theme out instead of choosing it.
  const tile = page.getByTestId('palette-tiefsee');
  await expect(tile).toHaveAccessibleName('Farbthema Tiefsee 30 Sekunden ansehen');
  await tile.click();
  await expect(html(page)).toHaveAttribute('data-palette', 'tiefsee');
  await expect(page.getByTestId('palette-preview')).toContainText('Vorschau: Tiefsee');
  expect(await page.evaluate(() => localStorage.getItem('tm-palette'))).toBeNull();
  // The theme sets the accent, so the accent picker rests meanwhile.
  await expect(page.getByRole('combobox', { name: 'Akzentfarbe' })).toBeDisabled();

  await page.clock.fastForward(29_000);
  await expect(html(page)).toHaveAttribute('data-palette', 'tiefsee');
  await page.clock.fastForward(1_500);
  await expect(html(page)).not.toHaveAttribute('data-palette', /.+/);
  await expect(page.getByTestId('palette-preview')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Akzentfarbe' })).toBeEnabled();
});

test('the preview can be ended early and survives no reload', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  await page.getByTestId('palette-sand').click();
  await expect(html(page)).toHaveAttribute('data-palette', 'sand');
  await page.getByRole('button', { name: 'Vorschau beenden' }).click();
  await expect(html(page)).not.toHaveAttribute('data-palette', /.+/);

  await page.getByTestId('palette-nordlicht').click();
  await page.reload();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(html(page)).not.toHaveAttribute('data-palette', /.+/);
});

test('the logo switch is locked without a code and nothing is blocked', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  await expect(page.getByRole('switch', { name: 'Logo in Themenfarbe' })).toBeDisabled();
  // Everything else on the page keeps working.
  await expect(page.getByRole('combobox', { name: 'Akzentfarbe' })).toBeEnabled();
});
