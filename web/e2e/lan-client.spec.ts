import { devices, expect, test, type Page } from '@playwright/test';

/**
 * Settings → Sync on the phone: pairing with the hub PC by its QR. The native scanner and the Noise
 * client live in the shell (Rust tests in `src-tauri/crates/lan-sync`); here the E2E build's stand-in
 * (`core/platform/fakeLanClient.ts`) answers, switched on per page.
 */
test.use({ ...devices['Pixel 7'] });

type Hooks = { nextScan(t: string): void; confirm(): Promise<void>; refuse(): void };
const hooks = (page: Page) =>
  page.evaluateHandle(() => (window as unknown as { __tmLanClient: Hooks }).__tmLanClient);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tm-e2e-lanclient', '1'));
});

test('pair with the PC by scanning, compare the code, then synced', async ({ page }, info) => {
  await page.goto('/settings/sync');
  await expect(page.getByTestId('lan-client-intro')).toContainText(
    'Gleiche im Heimnetz mit deinem PC ab.',
  );
  await page.getByTestId('lan-client').screenshot({ path: info.outputPath('phone-1-start.png') });

  await (await hooks(page)).evaluate((h) => h.nextScan('NEMO1:from-the-pc'));
  await page.getByTestId('lan-pair-pc').click();
  const dialog = page.getByRole('dialog', { name: 'Mit PC koppeln' });
  await expect(dialog.getByTestId('lan-confirm-on-pc')).toHaveText(
    'Am PC bestätigen · Code 482 913',
  );
  await page.waitForTimeout(400); // let the dialog finish fading in
  await dialog.screenshot({ path: info.outputPath('phone-2-confirm.png') });

  // the user taps "Koppeln" on the PC
  await (await hooks(page)).evaluate((h) => h.confirm());
  await expect(page.getByTestId('lan-client-state')).toHaveText('Abgeglichen');
  await expect(page.getByTestId('lan-client-status')).toContainText('Mit deinem PC gekoppelt');
  await page.getByTestId('lan-client').screenshot({ path: info.outputPath('phone-3-synced.png') });
});

test('a code that is not from Nemo is said plainly', async ({ page }) => {
  await page.goto('/settings/sync');
  await (await hooks(page)).evaluate((h) => h.nextScan('https://example.com'));
  await page.getByTestId('lan-pair-pc').click();
  await expect(page.getByTestId('lan-pair-failure')).toHaveText(
    'Das ist kein Kopplungscode von Nemo.',
  );
});

test('after the PC unpaired this phone it offers "Neu koppeln", never red', async ({ page }) => {
  await page.goto('/settings/sync');
  await (await hooks(page)).evaluate((h) => h.nextScan('NEMO1:x'));
  await page.getByTestId('lan-pair-pc').click();
  await expect(page.getByTestId('lan-confirm-on-pc')).toBeVisible();
  await (await hooks(page)).evaluate((h) => h.confirm());
  await expect(page.getByTestId('lan-client-state')).toHaveText('Abgeglichen');

  await (await hooks(page)).evaluate((h) => h.refuse());
  await page.getByRole('button', { name: 'Jetzt abgleichen' }).click();
  await expect(page.getByTestId('lan-client-state')).toHaveText('Diese Kopplung wurde gelöst.');
  await expect(page.getByTestId('lan-pair-pc')).toHaveText('Neu koppeln');
});
