import { expect, test } from '@playwright/test';

/**
 * Settings → Sync on the desktop app with this PC as the home-network hub. The hub itself lives in
 * the native shell (Rust tests in `src-tauri/crates/lan-sync`); here the E2E build's stand-in
 * (`core/platform/fakeLanHub.ts`) answers, switched on per page.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tm-e2e-lanhub', '1'));
});

test('pair a phone by QR without typing, then see it in the device list', async ({
  page,
}, info) => {
  await page.goto('/settings/sync');
  await expect(page.getByTestId('lan-hub-intro')).toContainText(
    'Gleiche dein Handy im Heimnetz mit diesem PC ab.',
  );
  // the own-server form is folded away, not gone
  await expect(page.getByTestId('sync-group-server')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Server-Adresse' })).toBeHidden();
  await page
    .getByTestId('lan-hub')
    .locator('..')
    .screenshot({ path: info.outputPath('lan-1-start.png') });

  await page.getByTestId('lan-pair').click();
  const dialog = page.getByRole('dialog', { name: 'Gerät koppeln' });
  await expect(dialog.getByTestId('lan-pair-qr')).toBeVisible();
  await page.waitForTimeout(400); // let the dialog finish fading in
  await dialog.screenshot({ path: info.outputPath('lan-2-qr.png') });

  // the phone scanned the code and knocks: the PC asks with name and code
  await page.evaluate(() =>
    (window as unknown as { __tmLanHub: { knock(n: string): boolean } }).__tmLanHub.knock(
      'Pixel 7',
    ),
  );
  await expect(dialog.getByTestId('lan-pair-ask')).toHaveText('Pixel 7 koppeln? Code 482 913');
  await dialog.screenshot({ path: info.outputPath('lan-3-confirm.png') });
  await dialog.getByTestId('lan-pair-confirm').click();
  await expect(dialog.getByTestId('lan-paired')).toHaveText('Pixel 7 ist gekoppelt.');
  await dialog.getByTestId('lan-pair-done').click();

  await expect(page.getByTestId('lan-hub-state')).toHaveText(
    'Dieser PC gleicht ab · 1 Gerät gekoppelt',
  );
  await expect(page.getByTestId('lan-device')).toContainText('Pixel 7');
  await page
    .getByTestId('lan-hub')
    .locator('..')
    .screenshot({ path: info.outputPath('lan-4-paired.png') });

  // everything that went to the hub is ciphertext
  expect(
    await page.evaluate(() =>
      (window as unknown as { __tmLanHub: { allEncrypted(): boolean } }).__tmLanHub.allEncrypted(),
    ),
  ).toBe(true);
});

test('unpairing asks once and the device disappears', async ({ page }) => {
  await page.goto('/settings/sync');
  await page.getByTestId('lan-pair').click();
  const dialog = page.getByRole('dialog', { name: 'Gerät koppeln' });
  await expect(dialog.getByTestId('lan-pair-qr')).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __tmLanHub: { knock(n: string): boolean } }).__tmLanHub.knock('Laptop'),
  );
  await dialog.getByTestId('lan-pair-confirm').click();
  await dialog.getByTestId('lan-pair-done').click();

  await page.getByTestId('lan-device').getByRole('button', { name: 'Kopplung lösen' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lösen' }).click();
  await expect(page.getByTestId('lan-note')).toHaveText('Laptop kann nicht mehr abgleichen.');
  await expect(page.getByTestId('lan-device')).toHaveCount(0);
});
