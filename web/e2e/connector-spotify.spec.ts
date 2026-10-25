import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Spotify connector: the line "Läuft gerade" and its controls against a mocked Web API. The login
 * itself (browser, redirect on port 38417) is a hand test (docs/MANUAL-TESTS.md S1–S4); here a
 * connected state with invented tokens is written into the app's device-local stores.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};
const TRACK = {
  is_playing: true,
  currently_playing_type: 'track',
  item: {
    name: 'Testlied',
    artists: [{ name: 'Erfundene Band' }],
    external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
  },
};

/** Writes client id + refresh token (sealed like the app does) and a connected status. */
async function seedConnected(page: Page, features: string[]) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(async (featureIds) => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('taschenmesser');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const done = (tx: IDBTransaction) =>
      new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    const db = await open();
    const existing = await new Promise<{ value: CryptoKey } | undefined>((resolve, reject) => {
      const req = db.transaction('_secrets').objectStore('_secrets').get('deviceKey');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const key =
      existing?.value ??
      (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const seal = async (name: string, value: string) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: new TextEncoder().encode(`taschenmesser/secret/${name}`),
        },
        key,
        new TextEncoder().encode(value),
      );
      return `v1.${b64(iv)}.${b64(new Uint8Array(data))}`;
    };
    const rows = [
      ['oauth:spotify:client-id', 'client-invented-123'],
      ['oauth:spotify:refresh', 'RT-invented'],
    ] as const;
    const sealed = await Promise.all(rows.map(async ([n, v]) => [n, await seal(n, v)] as const));
    const tx = db.transaction(['_secrets', '_meta'], 'readwrite');
    const secrets = tx.objectStore('_secrets');
    if (!existing) secrets.put({ key: 'deviceKey', value: key });
    for (const [n, token] of sealed) secrets.put({ key: `secret:${n}`, value: token });
    tx.objectStore('_meta').put({
      key: 'connector.spotify',
      value: { state: 'connected', features: featureIds },
    });
    await done(tx);
    db.close();
  }, features);
}

interface Mock {
  api: string[];
  player: () => { status: number; body?: unknown };
  command: (name: string) => { status: number; body?: unknown };
}

/** Mocks the token endpoint and the Web API; `api` collects "METHOD path" of every call. */
async function mockSpotify(page: Page): Promise<Mock> {
  const mock: Mock = {
    api: [],
    player: () => ({ status: 200, body: TRACK }),
    command: () => ({ status: 204 }),
  };
  await page.route('https://accounts.spotify.com/api/token', (route) =>
    route.fulfill({
      status: 200,
      headers: CORS,
      json: { access_token: 'AT-invented', expires_in: 3600 },
    }),
  );
  await page.route('https://api.spotify.com/**', (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(request.url()).pathname.replace('/v1/me/player', '');
    mock.api.push(`${request.method()} ${path}`);
    const reply = path === '/currently-playing' ? mock.player() : mock.command(path.slice(1));
    return route.fulfill({
      status: reply.status,
      headers: CORS,
      ...(reply.body === undefined ? {} : { json: reply.body }),
    });
  });
  return mock;
}

test.describe('Spotify connector', () => {
  test('settings: the card is there, says desktop only and offers no login on this device', async ({
    page,
  }) => {
    await ready(page, '/settings/verbindungen');
    const card = page.getByTestId('connector-spotify');
    await expect(card).toBeVisible();
    await expect(card.getByText('Nicht verbunden')).toBeVisible();
    await expect(card.getByText(/nur in der Windows-App/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Verbinden' })).toHaveCount(0);
  });

  test('not connected: no line and no request to Spotify', async ({ page }) => {
    const mock = await mockSpotify(page);
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('now-playing-line')).toHaveCount(0);
    expect(mock.api).toEqual([]);
  });

  test('connected: one calm line with the title as a link, pause/resume and next', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    const line = page.getByTestId('now-playing-line');
    await expect(line).toContainText('Läuft gerade: Testlied – Erfundene Band');
    const link = line.getByRole('link', { name: 'Testlied' });
    await expect(link).toHaveAttribute('href', 'https://open.spotify.com/track/abc123');
    await expect(link).toHaveAttribute('rel', 'noreferrer noopener');

    await line.getByRole('button', { name: 'Pause' }).click();
    await expect(line).toContainText('Pausiert: Testlied');
    await line.getByRole('button', { name: 'Weiter' }).click();
    await expect(line).toContainText('Läuft gerade: Testlied');
    await line.getByRole('button', { name: 'Nächster' }).click();
    await expect.poll(() => mock.api).toContain('POST /next');
    expect(mock.api).toContain('PUT /pause');
    expect(mock.api).toContain('PUT /play');
  });

  test('display only: no controls without the "Steuern" feature', async ({ page }) => {
    await mockSpotify(page);
    await seedConnected(page, ['show']);
    await ready(page, '/');
    const line = page.getByTestId('now-playing-line');
    await expect(line).toContainText('Testlied');
    await expect(line.getByRole('button')).toHaveCount(0);
  });

  test('nothing playing (204): the line is not there', async ({ page }) => {
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 204 });
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    await expect.poll(() => mock.api).toContain('GET /currently-playing');
    await expect(page.getByTestId('now-playing-line')).toHaveCount(0);
  });

  test('without Premium the controls go away with one quiet hint, the display stays', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    mock.command = () => ({
      status: 403,
      body: { error: { status: 403, reason: 'PREMIUM_REQUIRED', message: 'Premium required' } },
    });
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    const line = page.getByTestId('now-playing-line');
    await line.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Steuern braucht Spotify Premium.')).toBeVisible();
    await expect(line.getByRole('button')).toHaveCount(0);
    await expect(line).toContainText('Testlied');
  });

  test('an expired sign-in turns the line off and the card says so', async ({ page }) => {
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 401, body: { error: { status: 401 } } });
    await seedConnected(page, ['show']);
    await ready(page, '/');
    await expect.poll(() => mock.api.length).toBeGreaterThan(0);
    await expect(page.getByTestId('now-playing-line')).toHaveCount(0);
    await ready(page, '/settings/verbindungen');
    await expect(
      page.getByTestId('connector-spotify').getByText('Abgelaufen', { exact: true }),
    ).toBeVisible();
  });
});
