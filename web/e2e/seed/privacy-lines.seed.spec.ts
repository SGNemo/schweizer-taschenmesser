import { expect, type Page } from '@playwright/test';
import { bootDev, test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * The privacy sentences stay on screen (UI audit 2026-11, package 0a-1b): the vault says where files and titles go,
 * the passwords page says before the first entry that the master password never leaves the device. A new head or
 * empty state must not drop them.
 */
const VAULT_LINE = 'Dateien bleiben auf diesem Gerät, nicht im Backup';
const ACCOUNTS_LINE = 'Das Master-Passwort und die Schlüssel verlassen dieses Gerät nie';

async function enableAccounts(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'accounts',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

for (const vp of [
  { name: '1920', size: DESKTOP, phone: false },
  { name: '412', size: PHONE, phone: true },
] as const) {
  test.describe(`privacy sentences at ${vp.name}`, () => {
    test.use({ viewport: vp.size, isMobile: vp.phone, hasTouch: vp.phone });

    test.describe('with test data', () => {
      test.use({ seeded: { scale: 'small', desktop: !vp.phone, preview: true } });
      test('the vault says where files and titles go', async ({ page }) => {
        await startSeeded(page, { phone: vp.phone });
        await openPage(page, '/vault');
        await expect(page.locator('main').getByText(VAULT_LINE)).toBeVisible();
      });
    });

    test('the passwords page without a vault says that the master password stays here', async ({
      page,
    }) => {
      await bootDev(page);
      await page.goto('/');
      await expect(page.locator('main h1').first()).toBeVisible();
      await enableAccounts(page);
      await openPage(page, '/accounts');
      await expect(page.locator('main').getByText(ACCOUNTS_LINE)).toBeVisible();
    });
  });
}
