import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Downloads module against the invented jobs of `core/platform/fakeDownloads.ts` (E2E builds only):
 * no network, no files. The fake records calls on `__tmDownloadCalls`.
 */

async function enable(page: Page, ids: string[]) {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (modules) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of modules)
            tx.objectStore('_modules').put({
              id,
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
    ids,
  );
}

/** What the UI asked the manager to do (the automatic speed-limit call is left out). */
const calls = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { __tmDownloadCalls?: string[] }).__tmDownloadCalls ?? []).filter(
      (c) => !c.startsWith('limit:'),
    ),
  );

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    label,
  ).toEqual([]);
}

const list = (page: Page) => page.getByRole('list', { name: 'Downloads' });

test.beforeEach(async ({ page }) => {
  await enable(page, ['downloads', 'browser']);
  await page.goto('/downloads');
  await expect(list(page).getByRole('listitem')).toHaveCount(3);
});

test('list shows progress, state and checksum in words; the page is accessible', async ({
  page,
}) => {
  const rows = list(page).getByRole('listitem');
  await expect(rows.nth(0)).toContainText('beispiel-linux-12.iso');
  await expect(rows.nth(0)).toContainText('Lädt');
  await expect(rows.nth(1)).toContainText('Fertig');
  await expect(rows.nth(1)).toContainText('SHA-256');
  await expect(rows.nth(2)).toContainText('Pausiert');
  await expect(page.getByText('Nemo öffnet oder startet sie nie.')).toBeVisible();
  await audit(page, 'downloads page');
});

test('one filled action per page; checksum and folder lines start where the title starts (U11, U29)', async ({
  page,
}) => {
  const primaries = await page
    .locator('main button')
    .evaluateAll((els) => els.filter((e) => /primary/.test(e.className)).map((e) => e.textContent));
  expect(primaries).toEqual(['Download hinzufügen']);
  const done = list(page).getByRole('listitem').nth(1);
  const left = async (text: RegExp | string) =>
    Math.round((await done.getByText(text).first().boundingBox())!.x);
  const title = await left('handbuch.pdf');
  expect(await left(/SHA-256/)).toBe(title);
});

test('the head counts what runs, the filter shows the history, the folder button reveals the last job', async ({
  page,
}) => {
  // What runs is the head's figure (Identity 4.0: no band under the head).
  await expect(page.getByTestId('downloads-running')).toHaveText(/1\s*läuft/);
  const rows = list(page).getByRole('listitem');
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('handbuch.pdf');
  await page.getByRole('button', { name: 'Probleme', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('Nichts in dieser Ansicht.')).toBeVisible();
  await page.getByRole('button', { name: 'Alle', exact: true }).click();
  await expect(rows).toHaveCount(3);
  // The way to the target folder is in the page's "⋯" menu (one action in the head).
  await page.getByRole('button', { name: 'Weitere Optionen' }).click();
  await page.getByRole('menuitem', { name: 'Zielordner zeigen' }).click();
  expect(await calls(page)).toEqual(['reveal:3']);
});

test('pause, resume and remove call the manager; deleting the file asks first', async ({
  page,
}) => {
  const rows = list(page).getByRole('listitem');
  await rows.nth(0).getByRole('button', { name: 'Pausieren' }).click();
  await rows.nth(2).getByRole('button', { name: 'Fortsetzen' }).click();
  await rows.nth(1).getByRole('button', { name: 'Im Ordner zeigen' }).click();
  expect(await calls(page)).toEqual(['pause:1', 'resume:3', 'reveal:2']);

  await rows.nth(1).getByRole('button', { name: 'Mehr' }).click();
  await page.getByRole('menuitem', { name: /Mit Datei löschen/ }).click();
  await expect(page.getByRole('dialog', { name: 'Datei löschen?' })).toContainText('handbuch.pdf');
  expect(await calls(page)).not.toContain('remove:2:data');
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(2);
  expect(await calls(page)).toContain('remove:2:data');
});

test('adding needs a click, warns about HTTP and explains a wrong address', async ({ page }) => {
  await page.getByRole('button', { name: 'Download hinzufügen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Download hinzufügen' });
  await dialog
    .getByLabel('Adresse (http:// oder https://)')
    .fill('http://mirror.example.org/a.iso');
  await expect(dialog.getByText('Diese Adresse ist nicht verschlüsselt (HTTP).')).toBeVisible();
  await audit(page, 'add dialog');
  await dialog.getByLabel('Adresse (http:// oder https://)').fill('ftp://mirror.example.org/a.iso');
  await dialog.getByRole('button', { name: 'Herunterladen' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Nur Adressen mit http:// oder https://');
  await dialog
    .getByLabel('Adresse (http:// oder https://)')
    .fill('https://mirror.example.org/neu.iso');
  await dialog.getByLabel(/Prüfsumme \(optional/).fill('ab'.repeat(32));
  await dialog.getByRole('button', { name: 'Herunterladen' }).click();
  await expect(list(page).getByRole('listitem')).toHaveCount(4);
  expect(
    (await calls(page)).some((c) => c.startsWith(`add:https://mirror.example.org/neu.iso:`)),
  ).toBe(true);
});

test('checksum of a finished file can be compared later', async ({ page }) => {
  const row = list(page).getByRole('listitem').nth(1);
  await row.getByRole('button', { name: 'Mehr' }).click();
  await page.getByRole('menuitem', { name: 'Prüfsumme vergleichen' }).click();
  await page.getByLabel('Prüfsumme (SHA-256 oder SHA-512)').fill('ab'.repeat(32));
  await page.getByRole('button', { name: 'Vergleichen' }).click();
  await expect(row).toContainText('Stimmt überein');
});

test('a download offered by a web page waits for a click in the manager', async ({ page }) => {
  await page.goto('/browser');
  const address = page.getByLabel('Adresse oder Suchbegriff');
  await address.fill('https://example.org/download-test');
  await address.press('Enter');
  await expect(
    page.getByText('Die Seite bietet „beispiel-datei.zip“ zum Download an.'),
  ).toBeVisible();
  expect(await calls(page)).toEqual([]);
  await page.getByRole('button', { name: 'Im Download-Manager öffnen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Download hinzufügen' });
  await expect(dialog.getByLabel('Adresse (http:// oder https://)')).toHaveValue(
    'https://example.org/files/beispiel-datei.zip',
  );
  expect((await calls(page)).some((c) => c.startsWith('add:'))).toBe(false);
});

// ---- BitTorrent part (fake engine: made-up torrents, no peers, no network) ----

const torrentCalls = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __tmTorrentCalls?: string[] }).__tmTorrentCalls ?? [],
  );

const turnOnTorrent = async (page: Page) => {
  await page.getByRole('button', { name: 'Torrent-Teil einschalten' }).click();
  // The one-time notice comes first; nothing starts before it is confirmed.
  const notice = page.getByRole('dialog', { name: 'BitTorrent: bitte kurz lesen' });
  await expect(notice).toContainText('Linux-Distributionen');
  expect(await torrentCalls(page)).toEqual([]);
  await notice.getByRole('button', { name: 'Verstanden' }).click();
};

test('BitTorrent is off by default; switching it on shows the notice once, then the engine starts', async ({
  page,
}) => {
  await expect(page.getByText('BitTorrent ist aus')).toBeVisible();
  expect(await torrentCalls(page)).toEqual([]);
  await audit(page, 'torrent off');
  await turnOnTorrent(page);
  await expect(page.getByRole('list', { name: 'BitTorrent' }).getByRole('listitem')).toHaveCount(3);
  expect((await torrentCalls(page))[0]).toMatch(/^configure:true:false:0:0:1:0$/);
  // Off again and on again: the notice does not come back.
  await page.getByRole('button', { name: 'Torrent-Teil ausschalten' }).click();
  await expect(page.getByText('BitTorrent ist aus')).toBeVisible();
  await page.getByRole('button', { name: 'Torrent-Teil einschalten' }).click();
  await expect(page.getByRole('dialog', { name: 'BitTorrent: bitte kurz lesen' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'BitTorrent' })).toBeVisible();
});

test('torrent rows say state, speed and ratio in words and can pause, resume and be removed', async ({
  page,
}) => {
  await turnOnTorrent(page);
  const rows = page.getByRole('list', { name: 'BitTorrent' }).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Teilt');
  await expect(rows.nth(0)).toContainText('Verhältnis 0.60');
  await expect(rows.nth(1)).toContainText('Lädt');
  await expect(rows.nth(1)).toContainText('7 Verbindungen');
  await expect(rows.nth(2)).toContainText('Pausiert');
  await audit(page, 'torrent list');

  await rows.nth(1).getByRole('button', { name: 'Pausieren' }).click();
  await rows.nth(2).getByRole('button', { name: 'Fortsetzen' }).click();
  const calls = await torrentCalls(page);
  expect(calls).toContain('pause:2');
  expect(calls).toContain('resume:3');

  await rows.nth(0).getByRole('button', { name: 'Mehr' }).click();
  await page.getByRole('menuitem', { name: 'Aus der Liste entfernen' }).click();
  await expect(rows).toHaveCount(2);
  expect(await torrentCalls(page)).toContain('remove:1:keep');

  await rows.nth(0).getByRole('button', { name: 'Mehr' }).click();
  await page.getByRole('menuitem', { name: /Mit Dateien löschen/ }).click();
  await expect(page.getByRole('dialog', { name: 'Dateien löschen?' })).toContainText(
    'freie-musik-sammlung',
  );
  expect(await torrentCalls(page)).not.toContain('remove:2:data');
  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  expect(await torrentCalls(page)).toContain('remove:2:data');
});

test('adding a torrent: magnet link → file list → choose files and folder → add', async ({
  page,
}) => {
  await turnOnTorrent(page);
  await page.getByRole('button', { name: 'Torrent hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Torrent hinzufügen' });
  await dialog.getByLabel('Magnet-Link').fill('https://example.org/not-a-magnet');
  await dialog.getByRole('button', { name: 'Dateien ansehen' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Das ist kein Magnet-Link.');
  await dialog.getByLabel('Magnet-Link').fill('magnet:?xt=urn:btih:' + 'a'.repeat(40));
  await dialog.getByRole('button', { name: 'Dateien ansehen' }).click();
  await expect(dialog.getByRole('heading', { name: 'beispiel-linux-12' })).toBeVisible();
  await audit(page, 'torrent files');
  await dialog.getByRole('button', { name: 'Keine' }).click();
  await expect(dialog.getByText('Wähle mindestens eine Datei.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Herunterladen' })).toBeDisabled();
  await dialog.getByLabel(/beispiel-linux-12\.iso/).check();
  await dialog.getByRole('button', { name: 'Herunterladen' }).click();
  await expect(page.getByRole('list', { name: 'BitTorrent' }).getByRole('listitem')).toHaveCount(4);
  expect((await torrentCalls(page)).some((c) => /^add:magnet:.*:0$/.test(c))).toBe(true);
});

test('a .torrent file is chosen in the system dialog; the public IP is only asked for on a click', async ({
  page,
}) => {
  await turnOnTorrent(page);
  await page.getByRole('button', { name: 'Torrent hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Torrent hinzufügen' });
  await dialog.getByRole('button', { name: '.torrent-Datei öffnen' }).click();
  await expect(dialog.getByText(/beispiel\.torrent/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Dateien ansehen' }).click();
  await expect(dialog.getByRole('heading', { name: 'beispiel-linux-12' })).toBeVisible();
  expect(await torrentCalls(page)).toContain('preview:file');
  await dialog.getByRole('button', { name: 'Zurück' }).click();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByText('Deine öffentliche IP-Adresse')).toBeVisible();
  await expect(page.getByTestId('torrent-ip')).toHaveCount(0);
});

// ---- magnet link / .torrent file from outside (optional OS association) ----

test('a magnet link the app was started with waits for the torrent part, then pre-fills the dialog', async ({
  page,
}) => {
  const magnet = 'magnet:?xt=urn:btih:' + 'b'.repeat(40);
  await page.evaluate((m) => localStorage.setItem('__tmLaunchPending', m), magnet);
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: 'Ein Magnet-Link wartet' }),
  ).toBeVisible();
  // Nothing was added or started by itself.
  expect(await torrentCalls(page)).toEqual([]);
  await turnOnTorrent(page);
  const dialog = page.getByRole('dialog', { name: 'Torrent hinzufügen' });
  await expect(dialog.getByLabel('Magnet-Link')).toHaveValue(magnet);
  await audit(page, 'prefilled dialog');
  expect((await torrentCalls(page)).some((c) => c.startsWith('add:'))).toBe(false);
});

test('registering with Windows is a click and can be undone', async ({ page }) => {
  await turnOnTorrent(page);
  const calls = () =>
    page.evaluate(
      () => (window as unknown as { __tmBrowserCalls?: string[] }).__tmBrowserCalls ?? [],
    );
  await expect(page.getByText('Ein bestehender Standard wird nicht ersetzt')).toBeVisible();
  expect(await calls()).not.toContain('association:on');
  await page.getByRole('button', { name: 'Bei Windows eintragen' }).click();
  await expect.poll(calls).toContain('association:on');
  await page.getByRole('button', { name: 'Eintrag entfernen' }).click();
  await expect.poll(calls).toContain('association:off');
  await audit(page, 'association');
});
