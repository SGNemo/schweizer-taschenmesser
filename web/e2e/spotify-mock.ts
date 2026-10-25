import { expect, type Page } from '@playwright/test';

/** Shared by the Spotify specs: a mocked token endpoint and Web API, and a connected state with invented tokens. */
export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
};
export const TRACK = {
  is_playing: true,
  currently_playing_type: 'track',
  item: {
    name: 'Testlied',
    artists: [{ name: 'Erfundene Band' }],
    external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
  },
};

/** Writes client id + refresh token (sealed like the app does) and a connected status. */
export async function seedConnected(page: Page, features: string[]) {
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

export interface Mock {
  api: string[];
  player: () => { status: number; body?: unknown };
  command: (name: string) => { status: number; body?: unknown };
  playlists: () => { status: number; body?: unknown };
}

/** Mocks the token endpoint and the Web API; `api` collects "METHOD path" of every call. */
export async function mockSpotify(page: Page): Promise<Mock> {
  const mock: Mock = {
    api: [],
    player: () => ({ status: 200, body: TRACK }),
    command: () => ({ status: 204 }),
    playlists: () => ({
      status: 200,
      body: {
        items: [
          { id: 'pl1ABC', name: 'Tiefer Fokus' },
          { id: 'pl2DEF', name: 'Ruhe' },
        ],
      },
    }),
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
    const body = request.postData();
    mock.api.push(`${request.method()} ${path}${body ? ` ${body}` : ''}`);
    const reply =
      path === '/currently-playing'
        ? mock.player()
        : path === '/v1/me/playlists'
          ? mock.playlists()
          : mock.command(path.slice(1));
    return route.fulfill({
      status: reply.status,
      headers: CORS,
      ...(reply.body === undefined ? {} : { json: reply.body }),
    });
  });
  return mock;
}
