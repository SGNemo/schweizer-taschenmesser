import { expect, test, type Page } from '@playwright/test';

// App side of the browser extension bridge. The native pipe is replaced by the e2e fake
// (`window.__tmVaultBridge`), everything behind it – validation, pairing, sessions, origin matching,
// saving through the vault – is the real app code.
const MASTER = 'Mein-Master-Passwort-1';
const EXTENSION_ID = 'olgcnfjmihlmpgjepkfbdjcpenckemaj';
const ORIGIN = `chrome-extension://${EXTENSION_ID}/`;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function setUp(page: Page) {
  await page.goto('/library');
  const card = page.getByTestId('module-accounts');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
  await page.goto('/accounts');
  await page.getByLabel('Master-Passwort', { exact: true }).fill(MASTER);
  await page.getByLabel('Master-Passwort wiederholen').fill(MASTER);
  await page.getByRole('button', { name: 'Tresor erstellen' }).click();
  await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
    timeout: 20_000,
  });
}

interface Reply {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown> & { entries?: Record<string, unknown>[] };
}

let seq = 0;
let session: string | undefined;
async function send(page: Page, op: string, body: object = {}, origin = ORIGIN): Promise<Reply> {
  const needsSession = !['hello', 'status'].includes(op);
  const message = {
    v: 1,
    id: crypto.randomUUID(),
    op,
    origin,
    body,
    ...(needsSession && session ? { session, seq: ++seq } : {}),
  };
  const raw = await page.evaluate(
    (json) =>
      (
        window as unknown as { __tmVaultBridge: { request(j: string): Promise<string | null> } }
      ).__tmVaultBridge.request(json),
    JSON.stringify(message),
  );
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string) as Reply;
}

async function enableBridge(page: Page) {
  await page.getByRole('button', { name: 'Browser-Erweiterung' }).click();
  const dialog = page.getByRole('dialog', { name: 'Browser-Erweiterung verbinden' });
  await dialog.getByLabel('Verbindung zur Browser-Erweiterung aktivieren').click();
  await expect(dialog.getByText('Bereit.')).toBeVisible();
  await expect(dialog.getByText('Brave: ja')).toBeVisible();
  await dialog
    .getByRole('button', { name: /Schließen|Close/ })
    .click()
    .catch(async () => {
      await page.keyboard.press('Escape');
    });
}

async function pair(page: Page) {
  const hello = await send(page, 'hello');
  expect(hello.data).toMatchObject({ state: 'pairing' });
  const dialog = page.getByRole('dialog', { name: 'Erweiterung verbinden?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(EXTENSION_ID)).toBeVisible();
  await expect(dialog.getByText(String(hello.data?.pairCode))).toBeVisible();
  await dialog.getByRole('button', { name: 'Verbinden' }).click();
  await expect(dialog).toHaveCount(0);
  const again = await send(page, 'hello');
  expect(again.data).toMatchObject({ state: 'unlocked' });
  session = again.data?.session as string;
  seq = 0;
}

test.beforeEach(() => {
  seq = 0;
  session = undefined;
});

test('first contact needs the user, then an entry created by the extension appears in the vault', async ({
  page,
}) => {
  await setUp(page);
  await enableBridge(page);
  await pair(page);

  const created = await send(page, 'create', {
    title: 'Beispiel-Shop',
    username: 'alice@example.org',
    password: 'Gen3rierte-Passwort-4711', // gitleaks:allow (invented fixture)
    url: '',
    pageOrigin: 'https://shop.example.net/registrieren',
  });
  expect(created.ok).toBe(true);

  // It is a normal vault entry (listed, encrypted at rest, queued for sync) …
  await expect(page.getByRole('button', { name: /Beispiel-Shop/ }).first()).toBeVisible();
  const stored = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const out: unknown[] = [];
          const tx = db.transaction(['accounts_entry', '_outbox']);
          for (const name of ['accounts_entry', '_outbox']) {
            tx.objectStore(name).getAll().onsuccess = (e) =>
              out.push((e.target as IDBRequest).result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(JSON.stringify(out));
          };
        };
      }),
  );
  expect(stored).not.toContain('Gen3rierte');
  expect(stored).not.toContain('Beispiel-Shop');
  expect(stored).toContain('accounts_entry'); // the outbox carries the (ciphertext) write

  // … and the extension can find it again for the same site, but not on a look-alike.
  const same = await send(page, 'match', { pageOrigin: 'https://www.shop.example.net/login' });
  expect(same.data?.entries).toHaveLength(1);
  expect(JSON.stringify(same)).not.toContain('Gen3rierte');
  const phishing = await send(page, 'match', { pageOrigin: 'https://shop.example.net.evil.test' });
  expect(phishing.data?.entries).toEqual([]);
  const entryId = same.data?.entries?.[0]?.id as string;
  const denied = await send(page, 'secret', {
    entryId,
    pageOrigin: 'https://shop-example.net',
    field: 'password',
  });
  expect(denied).toMatchObject({ ok: false, error: 'origin-mismatch' });
  const allowed = await send(page, 'secret', {
    entryId,
    pageOrigin: 'https://shop.example.net',
    field: 'password',
  });
  expect(allowed.data).toEqual({ value: 'Gen3rierte-Passwort-4711' });
});

test('an unconfirmed or wrong extension gets no data, and locking ends the session', async ({
  page,
}) => {
  await setUp(page);
  await enableBridge(page);

  const stranger = await send(page, 'hello', {}, `chrome-extension://${'a'.repeat(32)}/`);
  expect(stranger.data).toEqual({ state: 'rejected' });
  await expect(page.getByRole('dialog', { name: 'Erweiterung verbinden?' })).toHaveCount(0);

  await pair(page);
  expect((await send(page, 'genParams')).ok).toBe(true);

  await page.getByRole('button', { name: 'Sperren' }).click();
  await expect(page.getByRole('button', { name: 'Entsperren' })).toBeVisible();
  expect(await send(page, 'status')).toMatchObject({ ok: true, data: { state: 'locked' } });
  const afterLock = await send(page, 'match', { pageOrigin: 'https://example.com' });
  expect(afterLock).toMatchObject({ ok: false, error: 'locked' });
  expect(afterLock.data).toBeUndefined();
});

test('declining the pairing keeps the extension out', async ({ page }) => {
  await setUp(page);
  await enableBridge(page);
  await send(page, 'hello');
  const dialog = page.getByRole('dialog', { name: 'Erweiterung verbinden?' });
  await dialog.getByRole('button', { name: 'Ablehnen' }).click();
  expect((await send(page, 'hello')).data).toEqual({ state: 'rejected' });
});
