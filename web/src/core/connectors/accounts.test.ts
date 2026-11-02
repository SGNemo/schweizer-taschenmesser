// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { deviceSecretNames } from '@/core/reset/device';
import { forgetAccessToken, accountKey } from './context';
import { addAccount, connectOAuth, disconnect, removeAccount, saveClient } from './service';
import { loadStatus, saveStatus } from './state';
import type { ConnectorDef } from './types';

const ENDPOINTS = {
  authUrl: 'https://auth.example.test/authorize',
  tokenUrl: 'https://auth.example.test/token',
  revokeUrl: 'https://auth.example.test/revoke',
};
const secrets = new Map<string, string>();
const revokedTokens: string[] = [];
let issued = 0;
let identity: string | undefined = 'second@example.org';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function install() {
  const web = createWebPlatform();
  const platform: PlatformService = {
    ...web,
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ENDPOINTS.tokenUrl) {
        issued += 1;
        return json({
          access_token: `AT-${issued}`,
          refresh_token: `RT-${issued}`,
          expires_in: 3600,
        });
      }
      if (url === ENDPOINTS.revokeUrl) {
        revokedTokens.push(String((init?.body as URLSearchParams).get('token')));
        return json({});
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch,
    secrets: {
      protection: 'device-key',
      get: async (n) => secrets.get(n),
      set: async (n, v) => void secrets.set(n, v),
      delete: async (n) => void secrets.delete(n),
    },
    app: { ...web.app, openUrl: async () => undefined },
    oauth: {
      supported: true,
      async start() {
        return { redirectUri: 'http://127.0.0.1:5555/callback', wait: async () => ({ code: 'C' }) };
      },
    },
  };
  setPlatform(platform);
}

const def: ConnectorDef = {
  id: 'google',
  name: 'Multi',
  description: 'x',
  icon: 'calendar',
  authType: 'oauth-pkce',
  platforms: ['desktop'],
  multiAccount: true,
  oauth: ENDPOINTS,
  features: [{ id: 'mail', label: 'Mail', description: '', scopes: ['mail.readonly'] }],
  identify: async () => identity,
};

beforeEach(async () => {
  secrets.clear();
  revokedTokens.length = 0;
  issued = 0;
  identity = 'second@example.org';
  forgetAccessToken('google');
  install();
  await db.table('_meta').clear();
});
afterEach(() => setPlatform(undefined));

describe('multiple accounts', () => {
  it('keeps the first account on the plain keys and stores extra ones apart', async () => {
    await saveClient('google', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['mail']);
    const { accountId, status } = await addAccount(def, ['mail']);

    expect(secrets.get('oauth:google:refresh')).toBe('RT-1');
    expect(secrets.get(`oauth:google#${accountId}:refresh`)).toBe('RT-2');
    expect(accountKey('google', accountId)).toBe(`google#${accountId}`);
    expect(status.state).toBe('connected');
    expect(status.accounts).toEqual([
      { id: accountId, email: 'second@example.org', features: ['mail'] },
    ]);
  });

  it('loads a status written before accounts existed', async () => {
    await saveStatus('google', { state: 'connected', features: ['mail'] });
    const status = await loadStatus('google');
    expect(status.accounts).toBeUndefined();
    expect(status.features).toEqual(['mail']);
  });

  it('does not break the first account when the extra login fails', async () => {
    await saveClient('google', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['mail']);
    // no feature chosen: the login is refused before anything is requested
    const { status } = await addAccount(def, []);
    expect(status.state).toBe('connected');
    expect(status.accounts ?? []).toEqual([]);
    expect(status.message).toBeTruthy();
  });

  it('keeps an account without a known address', async () => {
    identity = undefined;
    await saveClient('google', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['mail']);
    const { status } = await addAccount(def, ['mail']);
    expect(status.accounts?.[0]?.email).toBeUndefined();
  });

  it('removes one account (revoked, key gone) and leaves the others', async () => {
    await saveClient('google', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['mail']);
    const { accountId } = await addAccount(def, ['mail']);
    await removeAccount(def, accountId);
    expect(revokedTokens).toEqual(['RT-2']);
    expect(secrets.has(`oauth:google#${accountId}:refresh`)).toBe(false);
    expect(secrets.get('oauth:google:refresh')).toBe('RT-1');
    expect((await loadStatus('google')).accounts).toEqual([]);
  });

  it('disconnect removes every account and lists them for the device reset', async () => {
    await saveClient('google', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['mail']);
    const { accountId } = await addAccount(def, ['mail']);
    expect(await deviceSecretNames()).toContain(`oauth:google#${accountId}:refresh`);
    await disconnect(def, { keepData: true });
    expect(revokedTokens.sort()).toEqual(['RT-1', 'RT-2']);
    expect([...secrets.keys()].filter((k) => k.endsWith(':refresh'))).toEqual([]);
  });

  it('refuses extra accounts for a connector that does not allow them', async () => {
    await expect(
      connectOAuth({ ...def, multiAccount: false }, ['mail'], { accountId: 'a1' }),
    ).rejects.toThrow();
  });
});
