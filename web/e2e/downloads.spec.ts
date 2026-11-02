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
