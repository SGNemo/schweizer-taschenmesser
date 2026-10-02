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
  await expect(page.locator('main h1')).toHaveText('Dieser PC');
  const cards = page.getByRole('list', { name: 'Laufwerke' }).getByRole('listitem');
  await expect(cards).toHaveCount(3);
  // The nearly full system drive says so in words, not only in colour.
  await expect(cards.first()).toContainText('Fast voll – Aufräumen empfohlen');
  await expect(cards.first()).toContainText('92 %');
  await expect(cards.first()).toContainText('NVMe-SSD');
  await expect(cards.first()).toContainText('Systemlaufwerk');
  await expect(cards.first()).toContainText('Beispiel NVMe 512');
  await expect(cards.first()).toContainText('476,8 GB');
  await expect(cards.first()).toContainText('41 °C');
  // Health that Windows does not hand out says why, in words.
  await expect(cards.nth(1)).toContainText(
    'nicht verfügbar – Windows gibt den Wert nur mit Administratorrechten heraus',
  );
  await expect(cards.nth(1)).toContainText('Festplatte (HDD)');
  await expect(cards.first()).toContainText('Noch nicht gescannt');
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
  await expect(page.getByRole('heading', { name: 'Dieser PC' })).toHaveCount(0);
  await expect(page.getByText('Dieser PC', { exact: true })).toHaveCount(0);
  await page.goto('/disk');
  await expect(page.getByRole('heading', { name: 'Dieser PC' })).toHaveCount(0);
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

// --- deleting (against the in-memory fake only; never a real path) -----------------------------

const rowButton = (page: Page, table: string, name: string) =>
  page.getByRole('table', { name: table }).getByRole('button', { name });

/** Opens the "biggest files/folders" list and selects one entry, so its details show. */
async function pick(page: Page, filter: 'Größte Dateien' | 'Größte Ordner', name: string) {
  await page.getByRole('button', { name: filter }).click();
  await rowButton(page, 'Schnellfilter', name).click();
  await expect(page.getByTestId('details').getByRole('heading', { name })).toBeVisible();
}

const deleteButton = (page: Page) =>
  page.getByTestId('details').getByRole('button', { name: /^Löschen/ });

test('protected entries are not offered for deletion, with the reason', async ({ page }) => {
  await openScan(page);
  await pick(page, 'Größte Ordner', 'System');
  await expect(page.getByTestId('protected-note')).toContainText('Windows');
  await expect(deleteButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zum Korb' })).toHaveCount(0);
  await pick(page, 'Größte Dateien', 'auslagerung.sys');
  await expect(page.getByTestId('protected-note')).toContainText('Systemdatei');
  await expect(deleteButton(page)).toHaveCount(0);
});

test('basket: collect two files, one confirmation with the sum, then the bin', async ({ page }) => {
  await openScan(page);
  await pick(page, 'Größte Dateien', 'alt.iso');
  await page.getByRole('button', { name: 'Zum Korb' }).click();
  await pick(page, 'Größte Dateien', 'archiv.zip');
  await page.getByRole('button', { name: 'Zum Korb' }).click();
  const basket = page.getByTestId('basket');
  await expect(basket).toContainText('alt.iso');
  await expect(basket).toContainText('archiv.zip');
  await expect(page.getByTestId('basket-total')).toContainText('2 Einträge');
  await basket.getByRole('button', { name: 'Alle löschen …' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('delete-items')).toContainText(
    'C:\\Nutzer\\Beispiel\\Downloads\\alt.iso',
  );
  await expect(dialog.getByTestId('delete-items')).toContainText(
    'C:\\Nutzer\\Beispiel\\Downloads\\archiv.zip',
  );
  await expect(dialog.getByTestId('delete-total')).toContainText('2 Einträge');
  await expect(dialog.getByRole('radio', { name: /In den Papierkorb verschieben/ })).toBeChecked();
  await audit(page, 'delete dialog');
  // Small, not permanent: no typing needed.
  await dialog.getByRole('button', { name: 'In den Papierkorb' }).click();
  const report = page.getByTestId('delete-report');
  await expect(report).toContainText('Gelöscht');
  await expect(report).toContainText('Papierkorb');
  await page.getByRole('button', { name: 'Schließen' }).last().click();
  await expect(page.getByTestId('basket')).toHaveCount(0);

  // The tree was corrected: the files are gone from the ranking without a new scan.
  await page.getByRole('button', { name: 'Größte Dateien' }).click();
  const table = page.getByRole('table', { name: 'Schnellfilter' });
  await expect(table).toBeVisible();
  await expect(table).not.toContainText('alt.iso');
  await expect(table).toContainText('daten.pak');
});

test('large deletions need the name typed in; a wrong text keeps the button off', async ({
  page,
}) => {
  await openScan(page);
  await pick(page, 'Größte Dateien', 'daten.pak');
  await deleteButton(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Sehr große Löschung');
  const confirm = dialog.getByRole('button', { name: 'In den Papierkorb' });
  await expect(confirm).toBeDisabled();
  const field = dialog.getByLabel('Tippe zur Bestätigung „daten.pak“ ein');
  await field.fill('daten');
  await expect(confirm).toBeDisabled();
  await field.fill('daten.pak');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByTestId('delete-report')).toContainText('Gelöscht');
});

test('permanent delete is a deliberate second choice with its own confirmation', async ({
  page,
}) => {
  await openScan(page);
  await pick(page, 'Größte Dateien', 'Steuer.pdf');
  await deleteButton(page).click();
  const dialog = page.getByRole('dialog');
  // Bin is the default and needs no typing for this small file.
  await expect(dialog.getByRole('button', { name: 'In den Papierkorb' })).toBeEnabled();
  await dialog.getByRole('radio', { name: /Endgültig löschen/ }).check();
  await expect(dialog).toContainText('nicht rückgängig');
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Tippe zur Bestätigung „Steuer.pdf“ ein').fill('Steuer.pdf');
  await confirm.click();
  await expect(page.getByTestId('delete-report')).toContainText('endgültig gelöscht');
});

test('user folders and programs get their own, clearer warning', async ({ page }) => {
  await openScan(page);
  await pick(page, 'Größte Ordner', 'Dokumente');
  await deleteButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('persönlichen Ordnern');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await pick(page, 'Größte Ordner', 'Editor');
  await deleteButton(page).click();
  await expect(page.getByRole('dialog')).toContainText('sieht nach einem Programm aus');
});

test('files in use: the report lists what stayed, with the reason', async ({ page }) => {
  await openScan(page);
  await pick(page, 'Größte Ordner', 'Editor');
  await deleteButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /Endgültig löschen/ }).check();
  await dialog.getByLabel('Tippe zur Bestätigung „Editor“ ein').fill('Editor');
  await dialog.getByRole('button', { name: 'Endgültig löschen' }).click();
  const report = page.getByTestId('delete-report');
  await expect(report).toContainText('Teilweise gelöscht');
  await expect(report).toContainText('C:\\Programme\\Editor\\Editor.exe');
  await expect(report).toContainText('Datei in Benutzung');
});

test('a bin that cannot take the item never deletes it silently', async ({ page }) => {
  await openScan(page, 'E:\\ (USB-Stick) scannen');
  await pick(page, 'Größte Dateien', 'Urlaub-2024.mp4');
  await deleteButton(page).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Wechseldatenträgern');
  await dialog.getByRole('button', { name: 'In den Papierkorb' }).click();
  const report = page.getByTestId('delete-report');
  await expect(report).toContainText('Papierkorb nicht möglich – nichts gelöscht');
  // Still there: the second, deliberate step is offered instead.
  await report.getByRole('button', { name: /Diese endgültig löschen/ }).click();
  const next = page.getByRole('dialog');
  await expect(next.getByRole('radio', { name: /Endgültig löschen/ })).toBeChecked();
  await next.getByLabel('Tippe zur Bestätigung „Urlaub-2024.mp4“ ein').fill('Urlaub-2024.mp4');
  await next.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByTestId('delete-report')).toContainText('endgültig gelöscht');
});

test('a running delete can be stopped; what is left stays untouched', async ({ page }) => {
  await openScan(page);
  for (const name of ['alt.iso', 'archiv.zip', 'setup-beispiel.exe', 'Steuer.pdf']) {
    await pick(page, 'Größte Dateien', name);
    await page.getByRole('button', { name: 'Zum Korb' }).click();
  }
  await page.getByTestId('basket').getByRole('button', { name: 'Alle löschen …' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'In den Papierkorb' }).click();
  await expect(dialog.getByText('Löschen läuft …').first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Stoppen' }).click();
  const report = page.getByTestId('delete-report');
  await expect(report).toContainText('abgebrochen');
  await expect(report).toContainText('Abgebrochen');
});

test('reveal and copy path use the native path of the entry', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openScan(page);
  await pick(page, 'Größte Dateien', 'daten.pak');
  await page.getByRole('button', { name: 'Im Explorer zeigen' }).click();
  expect(
    await page.evaluate(() => (globalThis as { __tmDiskRevealed?: string[] }).__tmDiskRevealed),
  ).toEqual(['C:\\Programme\\Spiel\\daten.pak']);
  await page.getByRole('button', { name: 'Pfad kopieren' }).click();
  await expect(page.getByText('Pfad kopiert.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'C:\\Programme\\Spiel\\daten.pak',
  );
});

test('duplicates: found by content, one copy always stays, the user fills the basket', async ({
  page,
}) => {
  await openScan(page);
  await page.getByRole('button', { name: 'Doppelte Dateien' }).click();
  await page.getByRole('button', { name: 'Doppelte Dateien suchen' }).click();
  const box = page.getByTestId('duplicates');
  await expect(box).toContainText('2 gleiche Dateien');
  const first = box.getByRole('checkbox').nth(0);
  const second = box.getByRole('checkbox').nth(1);
  await first.check();
  await expect(second).toBeDisabled();
  await expect(box).toContainText('Mindestens eine Datei bleibt');
  await expect(page.getByTestId('basket')).toContainText('Urlaub-2024');
  await first.uncheck();
  await expect(second).toBeEnabled();
});

test('empty folders are listed', async ({ page }) => {
  await openScan(page);
  await page.getByRole('button', { name: 'Leere Ordner' }).click();
  await expect(page.getByRole('table', { name: 'Schnellfilter' })).toContainText('Leer');
});

test('clean-up places on the drives page start a scan of that folder', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2025-06-15T00:00:00Z'));
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await expect(page.getByRole('heading', { name: 'Schnellübersicht' })).toBeVisible();
  await page.getByRole('button', { name: 'Downloads scannen' }).click();
  await expect(
    page.getByRole('heading', { name: /Scan von C:\\Nutzer\\Beispiel\\Downloads/ }),
  ).toBeVisible();
  await expect(page.getByTestId('treemap')).toBeVisible();
});

test('tab System shows CPU, memory, battery, graphics, network and the biggest programs', async ({
  page,
}) => {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await page.getByRole('button', { name: 'System', exact: true }).click();
  await expect(page).toHaveURL(/tab=system/);
  const info = page.getByTestId('system-info');
  await expect(info).toContainText('Beispiel-Prozessor 3000');
  await expect(info).toContainText('8 Kerne, 16 Threads');
  await expect(page.getByTestId('tile-ram')).toContainText('9,5 GB von 16,0 GB belegt (59 %)');
  await expect(page.getByTestId('tile-battery')).toContainText('64 %, wird geladen');
  await expect(page.getByTestId('tile-cpu')).toBeVisible();
  await expect(page.getByTestId('tile-net')).toContainText('↓');
  // The graphics card is listed with memory and driver; the basic render driver never is.
  await expect(info).toContainText('Beispiel-Grafik 4000');
  await expect(info).toContainText('12,0 GB Grafikspeicher');
  await expect(info).toContainText('Treiber 31.0.15.5123');
  await expect(info).not.toContainText('Basic Render');
  // Network: Wi-Fi with name and signal, one main IPv6, the rest behind a button, virtual muted.
  await expect(info).toContainText('Beispiel-WLAN');
  await expect(info).toContainText('Signal stark (78 %)');
  await expect(info).toContainText('192.168.1.20');
  await expect(info).toContainText('2001:db8::20');
  await expect(info).not.toContainText('2001:db8::abcd');
  await page.getByRole('button', { name: 'Alle Adressen anzeigen' }).click();
  await expect(info).toContainText('2001:db8::abcd');
  await expect(info.locator('[data-kind="virtual"]')).toContainText('vEthernet (WSL)');
  await expect(info).toContainText('Beispiel Mainboard B650');
  await expect(info).toContainText('2 × 8,0 GB DDR5 · 6000 MHz');
  await expect(info).toContainText('2560 × 1440, 144 Hz (Hauptbildschirm)');
  await expect(info).toContainText('3 Tage, 5 Std.');
  const procs = page.getByTestId('system-processes');
  await expect(procs.getByRole('row').nth(1)).toContainText('browser.exe');
  await expect(procs.getByRole('row').nth(1)).toContainText('14 Prozesse');
  await expect(procs.getByRole('row').nth(1)).toContainText('4,2 %');
  await expect(page.getByText('Nur zur Ansicht')).toBeVisible();
  await page.getByRole('button', { name: 'Im Task-Manager öffnen' }).click();
  expect(
    await page.evaluate(
      () => (globalThis as { __tmTaskManagerOpened?: number }).__tmTaskManagerOpened,
    ),
  ).toBeGreaterThan(0);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('drive cards and system tiles pass axe in the dark theme too', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await expect(page.getByRole('list', { name: 'Laufwerke' }).getByRole('listitem')).toHaveCount(3);
  await audit(page, 'drives (dark)');
  await page.goto('/disk?tab=system');
  await expect(page.getByTestId('system-info')).toBeVisible();
  await audit(page, 'system (dark)');
});

test('public IP is only asked for on a click and only shows the answer', async ({ page }) => {
  let asked = 0;
  await page.route('https://api.ipify.org/**', async (route) => {
    asked++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ip: '203.0.113.7' }),
    });
  });
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk?tab=system');
  await expect(page.getByTestId('system-info')).toBeVisible();
  await expect(page.getByText('Fragt den Dienst api.ipify.org')).toBeVisible();
  expect(asked).toBe(0);
  await page.getByRole('button', { name: 'Öffentliche IP abfragen' }).click();
  await expect(page.getByTestId('public-ip')).toHaveText('203.0.113.7');
  expect(asked).toBe(1);
});

test('quick overview lists sizes of clean-up places and the recycle bin without a scan', async ({
  page,
}) => {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/disk');
  await expect(page.getByRole('heading', { name: 'Schnellübersicht' })).toBeVisible();
  const quick = page.getByRole('region', { name: 'Aufräumen' });
  await expect(quick).toContainText('Downloads');
  await expect(quick).toContainText('mindestens 11,5 GB');
  await expect(quick).toContainText('3,2 GB');
  await expect(quick.getByText('Papierkorb')).toBeVisible();
  await expect(quick).toContainText('1,1 GB');
});

test('the old /system path leads to the System tab', async ({ page }) => {
  await asDesktop(page);
  await enableDisk(page);
  await page.goto('/system');
  await expect(page).toHaveURL(/\/disk\?tab=system/);
  await expect(page.getByTestId('system-info')).toBeVisible();
});

test('browser and Android: Dieser PC does not exist', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByText('Dieser PC', { exact: true })).toHaveCount(0);
});
