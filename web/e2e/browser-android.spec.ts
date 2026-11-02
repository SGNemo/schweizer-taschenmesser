import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Browser module on Android: addresses go to Custom Tabs (`core/platform/fakeCustomTabs.ts`, E2E
 * builds only), which records them on `__tmBrowserCalls`; bookmarks and history stay in Nemo.
 */

async function asAndroid(page: Page) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'android'));
}

async function enableBrowser(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'browser',
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

const calls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __tmBrowserCalls?: string[] }).__tmBrowserCalls ?? [],
  );

test.beforeEach(async ({ page }) => {
  await asAndroid(page);
  await enableBrowser(page);
  await page.goto('/browser');
  await expect(page.getByLabel('Adresse oder Suchbegriff')).toBeVisible();
});

test('an address or search term opens in a Custom Tab; it is bookmarked and listed', async ({
  page,
}) => {
  await expect(page.getByText('Custom Tab')).toBeVisible();
  const address = page.getByLabel('Adresse oder Suchbegriff');
  await address.fill('example.org');
  await address.press('Enter');
  await expect.poll(() => calls(page)).toContain('customTab:https://example.org/');
  await page.getByRole('button', { name: 'Lesezeichen setzen' }).click();
  await expect(page.getByRole('list', { name: 'Lesezeichen' })).toContainText('example.org');
  await address.fill('wetter in bern');
  await address.press('Enter');
  await expect
    .poll(async () =>
      (await calls(page)).some((c) => c.includes('duckduckgo.com/?q=wetter%20in%20bern')),
    )
    .toBe(true);
  await expect(page.getByRole('list', { name: 'Zuletzt besucht' })).toContainText('example.org');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
