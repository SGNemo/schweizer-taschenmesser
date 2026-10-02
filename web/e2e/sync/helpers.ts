import {
  expect,
  type APIRequestContext,
  type Browser,
  type Page,
  type BrowserContext,
} from '@playwright/test';

export const SERVER = 'http://127.0.0.1:8787';
export const TOKEN = 'e2e-sync-token-0123456789';

export interface Device {
  context: BrowserContext;
  page: Page;
}

/** A separate "device": its own browser context, hence its own IndexedDB. */
export async function newDevice(browser: Browser): Promise<Device> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
  });
  return { context, page: await context.newPage() };
}

export async function resetServer(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${SERVER}/v1/reset`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    data: { confirm: 'RESET' },
  });
  expect(res.ok()).toBe(true);
}

/** Everything the server currently stores, as raw text (to assert what it can and cannot see). */
export async function serverDump(
  request: APIRequestContext,
): Promise<{ text: string; ops: { value: unknown; field: string }[] }> {
  const res = await request.get(`${SERVER}/v1/pull?since=0&limit=5000`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  const text = await res.text();
  return { text, ops: (JSON.parse(text) as { ops: { value: unknown; field: string }[] }).ops };
}

/** Records still waiting to be pushed, read straight from IndexedDB. */
export async function outboxCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('_outbox').objectStore('_outbox').count();
          req.onsuccess = () => {
            db.close();
            resolve(req.result);
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

export async function openSettings(page: Page): Promise<void> {
  if (!page.url().endsWith('/settings/sync')) await page.goto('/settings/sync');
  await expect(page.getByRole('heading', { name: 'Synchronisation' })).toBeVisible();
}

export interface ConnectOptions {
  url?: string;
  token?: string;
  passphrase?: string;
  encrypt?: boolean;
  deviceName?: string;
}

/** Fills the connection form and submits it; the caller asserts the outcome. */
export async function submitConnect(page: Page, o: ConnectOptions = {}): Promise<void> {
  await openSettings(page);
  await page.getByLabel('Server-Adresse').fill(o.url ?? SERVER);
  await page.getByLabel('Zugangstoken').fill(o.token ?? TOKEN);
  if (o.deviceName) await page.getByLabel('Gerätename').fill(o.deviceName);
  const encrypt = page.getByRole('switch', { name: /Ende-zu-Ende/ });
  if (o.encrypt && (await encrypt.getAttribute('aria-checked')) !== 'true') await encrypt.click();
  if (o.passphrase !== undefined) {
    // The field appears with the switch or after the server asked for a passphrase.
    await page.getByLabel('Passphrase').fill(o.passphrase);
  }
  await page.getByRole('button', { name: 'Verbinden', exact: true }).click();
}

export async function connect(page: Page, o: ConnectOptions = {}): Promise<void> {
  await submitConnect(page, o);
  await expect(page.getByTestId('sync-status')).toContainText('Synchronisiert');
}

/**
 * Runs two full sync cycles from the settings page and waits until nothing is queued locally.
 * Two cycles, because the first click may coincide with an automatic sync that is already running.
 */
export async function syncNow(page: Page): Promise<void> {
  await openSettings(page);
  for (let i = 0; i < 2; i++) {
    const pulled = page.waitForResponse((r) => r.url().includes('/v1/pull') && r.ok());
    await page.getByRole('button', { name: 'Jetzt synchronisieren' }).click();
    await pulled;
    await expect.poll(() => outboxCount(page)).toBe(0);
  }
  await expect(page.getByTestId('sync-status')).toContainText('Synchronisiert');
}

export async function addTask(page: Page, title: string): Promise<void> {
  await page.goto('/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible();
  // The write is finished when the entry shows up; wait for the outbox to include it.
  await expect.poll(() => outboxCount(page)).toBeGreaterThan(0);
}
