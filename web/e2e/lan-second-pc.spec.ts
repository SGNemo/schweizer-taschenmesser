import { expect, test, type Page } from '@playwright/test';

/**
 * Settings → Sync on a second PC: "Mit einem anderen PC koppeln" pairs this PC as a client with the
 * hub PC (QR by webcam). Hub and client are the E2E build's stand-ins (`fakeLanHub.ts`,
 * `fakeLanClient.ts`), both switched on: the page is a desktop app that could be either, never both.
 */
type Hooks = {
  nextScan(t: string): void;
  failScan(reason: string): void;
  confirm(): Promise<void>;
};
const hooks = (page: Page) =>
  page.evaluateHandle(() => (window as unknown as { __tmLanClient: Hooks }).__tmLanClient);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tm-e2e-lanhub', '1');
    localStorage.setItem('tm-e2e-lanclient', '1');
  });
});

test('a second PC pairs with the hub PC by webcam and then shows the device side', async ({
  page,
}, info) => {
  await page.goto('/settings/sync');
  await expect(page.getByTestId('lan-hub-intro')).toBeVisible();
  const link = page.getByTestId('lan-pair-other-pc');
  await expect(link).toHaveText('Mit einem anderen PC koppeln');
  await page
    .getByTestId('lan-hub')
    .locator('..')
    .screenshot({ path: info.outputPath('second-pc-1-start.png') });

  await (await hooks(page)).evaluate((h) => h.nextScan('NEMO1:from-the-hub-pc'));
  await link.click();
  const dialog = page.getByRole('dialog', { name: 'Mit einem anderen PC koppeln' });
  await expect(dialog.getByTestId('lan-confirm-on-pc')).toHaveText(
    'Am PC bestätigen · Code 482 913',
  );
  await page.waitForTimeout(400); // let the dialog finish fading in
  await dialog.screenshot({ path: info.outputPath('second-pc-2-confirm.png') });

  await (await hooks(page)).evaluate((h) => h.confirm());
  // one path per device: this PC is a client now, the hub screen with "Gerät koppeln" is gone
  await expect(page.getByTestId('lan-client-state')).toHaveText('Abgeglichen');
  await expect(page.getByTestId('lan-client-status')).toContainText('Mit deinem PC gekoppelt');
  await expect(page.getByTestId('lan-hub')).toHaveCount(0);
  await expect(page.getByTestId('lan-pair')).toHaveCount(0);
  await page
    .getByTestId('lan-client')
    .screenshot({ path: info.outputPath('second-pc-3-synced.png') });
});

test('a PC without a webcam says so calmly and points to the own server', async ({
  page,
}, info) => {
  await page.goto('/settings/sync');
  await (await hooks(page)).evaluate((h) => h.failScan('no-camera'));
  await page.getByTestId('lan-pair-other-pc').click();
  const line = page.getByTestId('lan-pair-failure');
  await expect(line).toContainText('Ohne Kamera geht das Koppeln mit einem anderen PC noch nicht.');
  await expect(page.getByTestId('lan-no-camera-server')).toContainText(
    '„Eigener Server (erweitert)“',
  );
  // still the hub's calm start screen: nothing turned on, the link stays as it was
  await expect(page.getByTestId('lan-pair-other-pc')).toHaveText('Mit einem anderen PC koppeln');
  await expect(page.getByTestId('lan-hub-intro')).toBeVisible();
  await page
    .getByTestId('lan-hub')
    .locator('..')
    .screenshot({ path: info.outputPath('second-pc-4-no-camera.png') });
});
