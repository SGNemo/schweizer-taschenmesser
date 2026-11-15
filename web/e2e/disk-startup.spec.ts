import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Tab "Autostart" of the disk module against the invented entries of
 * `core/platform/fakeDisk.ts` (E2E builds only). Nothing here touches a real registry.
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

async function openStartup(page: Page) {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await page.getByRole('button', { name: 'Autostart', exact: true }).click();
  await expect(page).toHaveURL(/\/disk\?tab=startup/);
  await expect(page.getByRole('list', { name: 'Für dein Konto' })).toBeVisible();
}

const musikbox = 'Musikbox mit Windows starten';

test('startup tab: own entries with a switch, machine-wide entries to look at', async ({
  page,
}) => {
  await openStartup(page);
  const own = page.getByRole('list', { name: 'Für dein Konto' });
  await expect(own.getByRole('listitem')).toHaveCount(4);
  await expect(own.getByRole('switch')).toHaveCount(4);
  await expect(page.getByText('3 von 4 eingeschaltet')).toBeVisible();
  await expect(own.getByRole('switch', { name: musikbox })).toBeChecked();
  await expect(
    own.getByRole('switch', { name: 'Plauderbox mit Windows starten' }),
  ).not.toBeChecked();
  // A shortcut says where it lies; a program whose name differs from the entry is named.
  await expect(own).toContainText('Autostart-Ordner · Notizzettel.lnk');
  await expect(own).toContainText('Update · ');

  // The PC's entries: no switch, the state as text, one way to Windows' settings.
  const machine = page.getByRole('list', { name: 'Für alle Konten' });
  await expect(machine.getByRole('listitem')).toHaveCount(1);
  await expect(machine).toContainText('Druckerhelfer');
  await expect(machine).toContainText('Eingeschaltet');
  await expect(machine.getByRole('switch')).toHaveCount(0);
  await page.getByRole('button', { name: 'In den Windows-Einstellungen ändern' }).click();
  expect(
    await page.evaluate(() => (globalThis as { __tmCareTools?: string[] }).__tmCareTools),
  ).toEqual(['startupApps']);
  // No invented figure for the start time: Windows rates it.
  await expect(page.getByText('schätzt Windows selbst', { exact: false })).toBeVisible();
});

test('startup tab: switching off is noted in the history and can be taken back there', async ({
  page,
}) => {
  await openStartup(page);
  await page.getByRole('switch', { name: musikbox }).click();
  await expect(page.getByRole('switch', { name: musikbox })).not.toBeChecked();
  await expect(page.getByText('Musikbox startet nicht mehr mit Windows.')).toBeVisible();
  await expect(page.getByText('2 von 4 eingeschaltet')).toBeVisible();

  await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
  const history = page.getByRole('list', { name: 'Verlauf' });
  await expect(history).toContainText('Musikbox: startet nicht mehr mit Windows');
  await history
    .getByRole('button', { name: 'Rückgängig: Musikbox: startet nicht mehr mit Windows' })
    .click();
  await expect(history).toContainText('Zurückgenommen.');

  await page.getByRole('button', { name: 'Autostart', exact: true }).click();
  await expect(page.getByRole('switch', { name: musikbox })).toBeChecked();
  await expect(page.getByText('3 von 4 eingeschaltet')).toBeVisible();
});

test('startup tab: the notice takes a switch back right away', async ({ page }) => {
  await openStartup(page);
  const chat = 'Plauderbox mit Windows starten';
  await page.getByRole('switch', { name: chat }).click();
  await expect(page.getByRole('switch', { name: chat })).toBeChecked();
  await expect(page.getByText('Plauderbox startet wieder mit Windows.')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(page.getByRole('switch', { name: chat })).not.toBeChecked();
});

test('startup tab has no accessibility violations', async ({ page }) => {
  await openStartup(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
