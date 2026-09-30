import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** System module against the invented values of `core/platform/fakeSystem.ts` (E2E builds only). */

async function enableSystem(page: Page) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
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
            id: 'system',
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

test('desktop: shows CPU, memory, battery, graphics, network and the biggest programs', async ({
  page,
}) => {
  await enableSystem(page);
  await page.goto('/system');
  await expect(page.locator('main h1')).toHaveText('Systeminfo');
  const info = page.getByTestId('system-info');
  await expect(info).toContainText('Beispiel-Prozessor 3000');
  await expect(info).toContainText('8 Kerne, 16 Threads');
  await expect(info).toContainText('9,5 GB von 16 GB belegt (59 %)');
  await expect(info).toContainText('64 %, wird geladen');
  await expect(info).toContainText('Beispiel-Grafikkarte (8 GB Grafikspeicher)');
  await expect(info).toContainText('192.168.1.20, 2001:db8::20');
  await expect(info).toContainText('3 Tage, 5 Std.');
  const procs = page.getByTestId('system-processes');
  await expect(procs.getByRole('row').nth(1)).toContainText('browser.exe');
  await expect(procs.getByRole('row').nth(1)).toContainText('14 Prozesse');
  await expect(page.getByText('Nur zur Ansicht')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('browser and Android: the module does not exist', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByText('Systeminfo', { exact: true })).toHaveCount(0);
});
