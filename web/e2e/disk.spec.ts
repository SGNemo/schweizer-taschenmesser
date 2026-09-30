import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Disk module against the invented folder tree of `core/platform/fakeDisk.ts` (E2E builds only).
 * Nothing here touches a real file system.
 */

/** Poses as the desktop app (E2E builds read `localStorage.__tmPlatformKind`). */
async function asDesktop(page: Page) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
}

async function enableDisk(page: Page) {
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
            id: 'disk',
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

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    label,
  ).toEqual([]);
}

test('desktop: drive cards, scan with progress, result and unreadable folders', async ({
  page,
}) => {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await expect(page.locator('main h1')).toHaveText('Datenträger');
  const cards = page.getByRole('list', { name: 'Datenträger' }).getByRole('listitem');
  await expect(cards).toHaveCount(3);
  // The nearly full system drive says so in words, not only in colour.
  await expect(cards.first()).toContainText('Fast voll');
  await expect(cards.first()).toContainText('92 %');
  await audit(page, 'drives page');

  await page.getByRole('button', { name: 'C:\\ (System) scannen' }).click();
  await expect(page).toHaveURL(/\/disk\/scan$/);
  await expect(page.getByText('Scan läuft')).toBeVisible();
  await expect(page.getByTestId('scan-total')).toBeVisible();
  await expect(page.getByTestId('scan-total')).toContainText('GB');
  await expect(
    page.getByRole('heading', { name: 'Nicht gelesen (Zugriff verweigert)' }),
  ).toBeVisible();
  await expect(page.getByTestId('not-read')).toContainText('Geschützt');
  await expect(page.getByText('Programme', { exact: true })).toBeVisible();
  await audit(page, 'scan result');

  await page.getByRole('link', { name: 'Zurück zu den Laufwerken' }).click();
  await expect(page).toHaveURL(/\/disk$/);
});

test('desktop: a running scan can be cancelled', async ({ page }) => {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await page.getByRole('button', { name: 'D:\\ (Daten) scannen' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Der Scan wurde abgebrochen')).toBeVisible();
});

test('browser and Android: the module does not exist', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.goto('/library');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Datenträger' })).toHaveCount(0);
  await expect(page.getByText('Datenträger', { exact: true })).toHaveCount(0);
  await page.goto('/disk');
  await expect(page.getByRole('heading', { name: 'Datenträger' })).toHaveCount(0);
});
