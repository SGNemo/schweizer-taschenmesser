import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Screenshots of the disk module with the invented folder tree of `core/platform/fakeDisk.ts`.
 * Manual tooling like `capture.spec.ts` (not part of CI): SCREENS_DIR=../docs/screenshots/disk npm run screenshots -- disk
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/disk';

test('disk module screenshots', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.clock.setFixedTime(new Date('2025-06-15T00:00:00Z'));
  await page.setViewportSize({ width: 1600, height: 1000 });
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
            id: 'disk',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'shot',
            deletedAt: null,
            _f: {},
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.goto('/disk');
  await expect(page.getByRole('button', { name: 'C:\\ (System) scannen' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/1-laufwerke.png` });

  await page.getByRole('button', { name: 'C:\\ (System) scannen' }).click();
  await expect(page.getByTestId('treemap')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/2-treemap.png` });

  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Einträge des Ordners' })).toBeVisible();
  await page.screenshot({ path: `${OUT}/3-liste.png` });

  await page.getByRole('button', { name: 'Größte Dateien' }).click();
  await page
    .getByRole('table', { name: 'Schnellfilter' })
    .getByRole('button', { name: 'alt.iso' })
    .click();
  await page.getByRole('button', { name: 'Zum Korb' }).click();
  await page
    .getByRole('button', { name: /^Löschen/ })
    .first()
    .click();
  await expect(page.getByTestId('delete-items')).toBeVisible();
  await page.screenshot({ path: `${OUT}/4-loeschen-bestaetigen.png` });
});
