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
  await expect(page.getByTestId('treemap')).toBeVisible();
  await expect(page.getByRole('img', { name: /Kartenansicht/ })).toBeVisible();
  await audit(page, 'scan result (map)');
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Einträge des Ordners' })).toBeVisible();
  await expect(
    page
      .getByRole('table', { name: 'Einträge des Ordners' })
      .getByText('Programme', { exact: true }),
  ).toBeVisible();
  await audit(page, 'scan result (list)');

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

/** The fake data is dated relative to 2025-06-15 (see FAKE_NOW in fakeDisk.ts). */
async function openScan(page: Page, drive = 'C:\\ (System) scannen') {
  await page.clock.setFixedTime(new Date('2025-06-15T00:00:00Z'));
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await page.getByRole('button', { name: drive }).click();
  await expect(page.getByTestId('treemap')).toBeVisible();
  // The scan finished once the map (and its size fetch) is there.
  await expect(page.getByTestId('scan-total')).toBeVisible();
}

test('treemap: click zooms into a folder, the breadcrumb goes back, details follow', async ({
  page,
}) => {
  await openScan(page);
  const canvas = page.getByRole('img', { name: /Kartenansicht/ });
  const crumbs = page.getByRole('navigation', { name: 'Pfad' });
  await expect(crumbs.getByRole('button')).toHaveCount(1);
  // The biggest folder ("Programme") is laid out top-left.
  await canvas.click({ position: { x: 8, y: 8 } });
  await expect(crumbs.getByRole('button', { name: 'Programme' })).toHaveAttribute(
    'aria-current',
    'location',
  );
  await expect(
    page.getByTestId('details').getByRole('heading', { name: 'Programme' }),
  ).toBeVisible();
  await expect(page.getByTestId('details-path')).toHaveText('C:\\Programme');
  await crumbs.getByRole('button', { name: 'C:\\' }).click();
  await expect(crumbs.getByRole('button', { name: 'Programme' })).toHaveCount(0);
});

test('treemap: keyboard selects, opens and goes up', async ({ page }) => {
  await openScan(page);
  const canvas = page.getByRole('img', { name: /Kartenansicht/ });
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByTestId('details').getByRole('heading', { name: 'Programme' }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Pfad' }).getByRole('button')).toHaveCount(2);
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('navigation', { name: 'Pfad' }).getByRole('button')).toHaveCount(1);
});

test('legend names every file type (text, not only colour)', async ({ page }) => {
  await openScan(page);
  const legend = page.getByRole('group', { name: 'Legende' });
  for (const kind of [
    'Videos',
    'Bilder',
    'Musik',
    'Archive',
    'Programme',
    'Dokumente',
    'Sonstiges',
  ])
    await expect(legend).toContainText(kind);
  await page.getByRole('button', { name: 'Tiefe', exact: true }).click();
  await expect(legend).toContainText('Je dunkler');
});

test('list view: sortable columns and details with the full path', async ({ page }) => {
  await openScan(page);
  await page.getByRole('button', { name: 'Liste', exact: true }).click();
  const table = page.getByRole('table', { name: 'Einträge des Ordners' });
  const names = async () =>
    (await table.getByRole('row').allInnerTexts()).slice(1).map((r) => r.split('\n')[0]!.trim());
  expect((await names())[0]).toBe('Programme');
  // First click on a column sorts descending, the second ascending.
  await table.getByRole('button', { name: 'Nach Name sortieren' }).click();
  expect((await names())[0]).toBe('System');
  await table.getByRole('button', { name: 'Nach Name sortieren' }).click();
  expect((await names())[0]).toBe('auslagerung.sys');
  await table.getByRole('button', { name: 'auslagerung.sys' }).click();
  await expect(page.getByTestId('details-path')).toHaveText('C:\\auslagerung.sys');
});

test('quick filters: biggest files, older than, by type', async ({ page }) => {
  await openScan(page);
  const table = page.getByRole('table', { name: 'Schnellfilter' });
  const first = async () =>
    (await table.getByRole('row').nth(1).innerText()).split('\n')[0]!.trim();

  await page.getByRole('button', { name: 'Größte Dateien' }).click();
  await expect(table).toBeVisible();
  expect(await first()).toBe('daten.pak');
  // The row tells where the file lives.
  await expect(table.getByRole('row').nth(1)).toContainText('Programme');

  await page.getByRole('button', { name: 'Größte Ordner' }).click();
  expect(await first()).toBe('Programme');

  await page.getByRole('button', { name: 'Älter als' }).click();
  await page.getByLabel('Älter als', { exact: true }).selectOption('24');
  await expect(table).toContainText('alt.iso');
  await expect(table).not.toContainText('Steuer.pdf');

  await page.getByRole('button', { name: 'Dateityp' }).click();
  await page.getByLabel('Dateityp', { exact: true }).selectOption('video');
  expect(await first()).toBe('Urlaub-2024.mp4');

  await page.getByRole('button', { name: 'Alle', exact: true }).click();
  await expect(page.getByTestId('treemap')).toBeVisible();
});

test('a result row opens the folder of the file in the map', async ({ page }) => {
  await openScan(page);
  await page.getByRole('button', { name: 'Größte Dateien' }).click();
  const table = page.getByRole('table', { name: 'Schnellfilter' });
  await table.getByRole('button', { name: 'daten.pak' }).click();
  await expect(page.getByTestId('details-path')).toHaveText('C:\\Programme\\Spiel\\daten.pak');
  await page.getByTestId('details').getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByTestId('treemap')).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Pfad' }).getByRole('button', { name: 'Spiel' }),
  ).toHaveAttribute('aria-current', 'location');
});
