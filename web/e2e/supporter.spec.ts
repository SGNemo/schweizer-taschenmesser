import { expect, test, type Page } from '@playwright/test';
import { E2E_CODE_KAFFEE, E2E_CODE_KUCHEN_ADA } from './supporterCodes';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';
const html = (page: Page) => page.locator('html');

async function enter(page: Page, code: string) {
  await ready(page, '/settings/ueber');
  await page.getByTestId('supporter-code-input').fill(code);
  await page.getByTestId('supporter-code-save').click();
}

test('a code unlocks the goodies, removing it takes them away again', async ({ page }) => {
  await enter(page, E2E_CODE_KUCHEN_ADA);
  await expect(page.getByTestId('supporter-status')).toContainText('Kuchen');
  await expect(page.getByTestId('supporter-status')).toContainText('Ada');
  await expect(page.getByTestId('supporter-badge-about')).toContainText('Danke, Ada · Kuchen');

  // Themes become selectable (no longer a preview) and survive a reload.
  await page.goto('/settings/darstellung');
  const sand = page.getByTestId('palette-sand');
  await expect(sand).toHaveAccessibleName('Farbthema Sand wählen');
  await sand.click();
  await expect(html(page)).toHaveAttribute('data-palette', 'sand');
  await expect(page.getByTestId('palette-preview')).toHaveCount(0);
  await page.reload();
  await expect(html(page)).toHaveAttribute('data-palette', 'sand');

  const logo = page.getByRole('switch', { name: 'Logo in Themenfarbe' });
  await expect(logo).toBeEnabled();
  await logo.click();
  await expect(html(page)).toHaveAttribute('data-logo', 'themed');

  // Remove the code: back to the normal look, the choice is not applied any more.
  await page.goto('/settings/ueber');
  await page.getByTestId('supporter-code-remove').click();
  await expect(page.getByTestId('supporter-status')).toContainText('Noch kein Code');
  await expect(html(page)).not.toHaveAttribute('data-palette', /.+/);
  await expect(html(page)).not.toHaveAttribute('data-logo', /.+/);
  await expect(page.getByTestId('supporter-badge-about')).toHaveCount(0);
  await page.goto('/settings/darstellung');
  await expect(page.getByTestId('palette-sand')).toHaveAccessibleName(
    'Farbthema Sand 30 Sekunden ansehen',
  );
  await expect(page.getByRole('switch', { name: 'Logo in Themenfarbe' })).toBeDisabled();
});

test('a wrong code is turned down kindly and changes nothing', async ({ page }) => {
  await enter(page, 'NEMO1-ABCDEF-GHJKMN');
  await expect(page.getByText('Dieser Code passt leider nicht')).toBeVisible();
  await expect(page.getByTestId('supporter-status')).toContainText('Noch kein Code');
  await expect(html(page)).not.toHaveAttribute('data-palette', /.+/);
});

test('the sidebar badge is off by default and can be switched on', async ({ page }, info) => {
  test.skip(isPhone(info), 'the sidebar head is desktop only');
  await enter(page, E2E_CODE_KAFFEE);
  await expect(page.getByTestId('supporter-status')).toContainText('Kaffee');
  await expect(page.getByTestId('supporter-badge-sidebar')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Danke-Abzeichen in der Seitenleiste' }).click();
  await expect(page.getByTestId('supporter-badge-sidebar')).toContainText('Kaffee');
});

test('the code is checked on the device: no request leaves the app while entering it', async ({
  page,
}) => {
  await ready(page, '/settings/ueber');
  const external: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(page.url()).origin && !u.protocol.startsWith('data')) {
      external.push(r.url());
    }
  });
  await page.getByTestId('supporter-code-input').fill(E2E_CODE_KAFFEE);
  await page.getByTestId('supporter-code-save').click();
  await expect(page.getByTestId('supporter-status')).toContainText('Kaffee');
  expect(external).toEqual([]);
});
