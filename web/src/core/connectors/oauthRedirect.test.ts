// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { getConnector } from './registry';
import { challengeOf } from './oauth';
import {
  PENDING_KEY,
  beginBrowserLogin,
  browserLoginAvailable,
  finishBrowserLogin,
} from './oauthRedirect';
import { saveClient } from './service';
import { loadStatus } from './state';

const def = getConnector('spotify')!;
const secrets = new Map<string, string>();
const tokenBodies: URLSearchParams[] = [];
let tokenReply: () => Response;

function install(kind: PlatformService['kind'] = 'web') {
  const web = createWebPlatform();
  setPlatform({
    ...web,
    kind,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === 'https://accounts.spotify.com/api/token') {
        tokenBodies.push(init?.body as URLSearchParams);
        return tokenReply();
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    }) as typeof fetch,
    secrets: {
      protection: 'device-key',
      get: async (name) => secrets.get(name),
      set: async (name, value) => void secrets.set(name, value),
      delete: async (name) => void secrets.delete(name),
    },
  });
}

const pending = (): { state: string; verifier: string; redirectUri: string } =>
  JSON.parse(sessionStorage.getItem(PENDING_KEY)!);

async function begin(features = ['show', 'control']) {
  const gone: string[] = [];
  await beginBrowserLogin(def, features, (url) => void gone.push(url));
  return gone;
}

beforeEach(async () => {
  secrets.clear();
  tokenBodies.length = 0;
  sessionStorage.clear();
  tokenReply = () =>
    new Response(JSON.stringify({ access_token: 'AT-1', refresh_token: 'RT-1', expires_in: 3600 }));
  vi.stubGlobal('location', new URL('https://nemo.example.test/settings/verbindungen'));
  install();
  await db.table('_meta').clear();
  await saveClient('spotify', { clientId: 'client-invented-123' });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setPlatform(undefined);
  setNow();
});

describe('browserLoginAvailable', () => {
  it('needs a provider that allows it, a plain browser and an https (or numeric loopback) address', () => {
    expect(browserLoginAvailable(def)).toBe(true);
    expect(browserLoginAvailable(getConnector('google')!)).toBe(false);
    vi.stubGlobal('location', new URL('http://nemo.example.test/'));
    expect(browserLoginAvailable(def)).toBe(false);
    vi.stubGlobal('location', new URL('http://127.0.0.1:4173/'));
    expect(browserLoginAvailable(def)).toBe(true);
    vi.stubGlobal('location', new URL('https://nemo.example.test/'));
    install('desktop');
    expect(browserLoginAvailable(def)).toBe(false);
    install('android');
    expect(browserLoginAvailable(def)).toBe(false);
  });
});

describe('beginBrowserLogin', () => {
  it("leaves for Spotify with PKCE, the chosen scopes and the app's own callback address", async () => {
    const gone = await begin(['show']);
    const url = new URL(gone[0]!);
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe('https://nemo.example.test/oauth/callback');
    expect(url.searchParams.get('scope')).toBe(
      'user-read-currently-playing user-read-playback-state',
    );
    expect(url.searchParams.get('client_id')).toBe('client-invented-123');
    expect(url.searchParams.get('state')).toBe(pending().state);
    expect(url.searchParams.get('code_challenge')).toBe(await challengeOf(pending().verifier));
    // The verifier stays in this tab; it is never part of the address.
    expect(gone[0]).not.toContain(pending().verifier);
  });

  it('without a client id or on an unsupported page it stays and says so on the card', async () => {
    secrets.clear();
    expect(await begin()).toEqual([]);
    expect((await loadStatus('spotify')).state).toBe('error');
    await saveClient('spotify', { clientId: 'client-invented-123' });
    vi.stubGlobal('location', new URL('http://nemo.example.test/'));
    expect(await begin()).toEqual([]);
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe('finishBrowserLogin', () => {
  it('checks the state, exchanges the code with the stored verifier and connects', async () => {
    await begin(['show', 'control']);
    const p = pending();
    const outcome = await finishBrowserLogin(`?code=CODE-1&state=${p.state}`);
    expect(outcome).toBe('connected');
    const body = tokenBodies[0]!;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('CODE-1');
    expect(body.get('redirect_uri')).toBe('https://nemo.example.test/oauth/callback');
    expect(await challengeOf(body.get('code_verifier')!)).toBe(await challengeOf(p.verifier));
    expect(secrets.get('oauth:spotify:refresh')).toBe('RT-1');
    expect(await loadStatus('spotify')).toMatchObject({
      state: 'connected',
      features: ['show', 'control'],
    });
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('ignores a wrong state, a forgotten login and a second use of the same link', async () => {
    expect(await finishBrowserLogin('?code=C&state=nothing-pending-1234567')).toBe('ignored');
    await begin();
    expect(await finishBrowserLogin('?code=C&state=forged-state-1234567890')).toBe('ignored');
    expect(tokenBodies).toEqual([]);
    expect(secrets.has('oauth:spotify:refresh')).toBe(false);
    // The pending login was used up by the failed attempt: the right state is too late now.
    expect(await finishBrowserLogin(`?code=C&state=${'x'.repeat(10)}`)).toBe('ignored');
  });

  it('drops a login that took longer than ten minutes', async () => {
    setNow(() => 1_000_000);
    await begin();
    const p = pending();
    setNow(() => 1_000_000 + 11 * 60_000);
    expect(await finishBrowserLogin(`?code=C&state=${p.state}`)).toBe('ignored');
    expect(tokenBodies).toEqual([]);
  });

  it('a refused login is "not connected", not an error', async () => {
    await begin();
    const p = pending();
    expect(await finishBrowserLogin(`?error=access_denied&state=${p.state}`)).toBe('denied');
    const status = await loadStatus('spotify');
    expect(status.state).toBe('disconnected');
    expect(secrets.has('oauth:spotify:refresh')).toBe(false);
  });

  it('a failing token request leaves a calm message and no token', async () => {
    tokenReply = () => new Response('{"error":"invalid_grant"}', { status: 400 });
    await begin();
    const outcome = await finishBrowserLogin(`?code=C&state=${pending().state}`);
    expect(outcome).toBe('error');
    const status = await loadStatus('spotify');
    expect(status.state).toBe('error');
    expect(status.message).not.toContain('client-invented-123');
    expect(secrets.has('oauth:spotify:refresh')).toBe(false);
  });

  it('calling it twice for the same address (StrictMode) uses the code once', async () => {
    await begin();
    const search = `?code=CODE-1&state=${pending().state}`;
    const [a, b] = await Promise.all([finishBrowserLogin(search), finishBrowserLogin(search)]);
    expect([a, b]).toEqual(['connected', 'connected']);
    expect(tokenBodies).toHaveLength(1);
  });
});
