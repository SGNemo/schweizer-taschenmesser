import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import { externalRepo } from '@/modules/calendar/repo';
import { forgetAccessToken } from './context';
import { challengeOf } from './oauth';
import {
  connectOAuth,
  describeError,
  disconnect,
  saveClient,
  selectCalendars,
  syncCalendars,
} from './service';
import { loadStatus } from './state';
import {
  ConnectorError,
  type CalendarSyncResult,
  type ConnectorDef,
  type ExternalEvent,
} from './types';

const ENDPOINTS = {
  authUrl: 'https://auth.example.test/authorize',
  tokenUrl: 'https://auth.example.test/token',
  revokeUrl: 'https://auth.example.test/revoke',
  authParams: { access_type: 'offline' },
};

const secrets = new Map<string, string>();
const opened: string[] = [];
const tokenBodies: URLSearchParams[] = [];
let waited: { state?: string } = {};
let waitOutcome: 'code' | 'denied' | 'timeout' | 'pending' = 'code';
let release: () => void = () => {};
let tokenResponse: () => Response;
let revoked = 0;

const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function installPlatform() {
  const web = createWebPlatform();
  const platform: PlatformService = {
    ...web,
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === ENDPOINTS.tokenUrl) {
        tokenBodies.push(init?.body as URLSearchParams);
        return tokenResponse();
      }
      if (url === ENDPOINTS.revokeUrl) {
        revoked += 1;
        return jsonResponse(200, {});
      }
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch,
    secrets: {
      protection: 'device-key',
      get: async (name) => secrets.get(name),
      set: async (name, value) => void secrets.set(name, value),
      delete: async (name) => void secrets.delete(name),
    },
    app: { ...web.app, openUrl: async (url) => void opened.push(url) },
    oauth: {
      supported: true,
      async start() {
        return {
          redirectUri: 'http://127.0.0.1:5555/callback',
          async wait(state) {
            waited = { state };
            if (waitOutcome === 'denied') throw new Error('denied: access_denied');
            if (waitOutcome === 'timeout') throw new Error('timeout');
            if (waitOutcome === 'pending')
              return new Promise<{ code: string }>((resolve) => {
                release = () => resolve({ code: 'CODE-1' });
              });
            return { code: 'CODE-1' };
          },
        };
      },
    },
  };
  setPlatform(platform);
}

const event = (extId: string, title: string, etag = 'e1'): ExternalEvent => ({
  extId,
  etag,
  title,
  allDay: true,
  startDate: '2026-10-01',
  kind: 'event',
});

let nextSync: () => CalendarSyncResult | Promise<CalendarSyncResult> = () => ({
  events: [],
  removedIds: [],
  full: true,
});
const syncCalls: { syncToken?: string; calendarId: string }[] = [];

const def: ConnectorDef = {
  id: 'testco',
  name: 'Testco',
  description: 'x',
  icon: 'calendar',
  authType: 'oauth-pkce',
  platforms: ['desktop'],
  oauth: ENDPOINTS,
  features: [
    { id: 'calendar', label: 'Kalender', description: '', scopes: ['cal.readonly'] },
    { id: 'mail', label: 'Mail', description: '', scopes: ['mail.readonly'] },
  ],
  calendar: {
    listCalendars: async () => [
      { id: 'primary', name: 'Privat', primary: true, color: '#112233' },
      { id: 'work', name: 'Arbeit' },
    ],
    async sync(ctx, req) {
      await ctx.accessToken();
      syncCalls.push({ syncToken: req.syncToken, calendarId: req.calendarId });
      return nextSync();
    },
  },
};

beforeEach(async () => {
  secrets.clear();
  opened.length = 0;
  tokenBodies.length = 0;
  syncCalls.length = 0;
  revoked = 0;
  waited = {};
  waitOutcome = 'code';
  tokenResponse = () =>
    jsonResponse(200, { access_token: 'AT-1', refresh_token: 'RT-1', expires_in: 3600 });
  nextSync = () => ({ events: [], removedIds: [], full: true });
  forgetAccessToken('testco');
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  installPlatform();
  await db.table('_meta').clear();
  await db.table('_outbox').clear();
  await db.table('calendar_external').clear();
});
afterEach(() => {
  setPlatform(undefined);
  setNow();
});

describe('connectOAuth', () => {
  it('runs the PKCE flow, stores the refresh token and marks the features', async () => {
    await saveClient('testco', { clientId: 'client-abc-123', clientSecret: 'GOCSPX-secret-value' });
    const status = await connectOAuth(def, ['calendar']);
    expect(status).toMatchObject({ state: 'connected', features: ['calendar'] });
    expect(secrets.get('oauth:testco:refresh')).toBe('RT-1');

    const url = new URL(opened[0]!);
    expect(url.searchParams.get('scope')).toBe('cal.readonly');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:5555/callback');
    expect(url.searchParams.get('state')).toBe(waited.state);
    expect(url.searchParams.get('access_type')).toBe('offline');
    // The verifier that was sent to the token endpoint hashes to the challenge in the login URL.
    const body = tokenBodies[0]!;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('CODE-1');
    expect(await challengeOf(body.get('code_verifier')!)).toBe(
      url.searchParams.get('code_challenge'),
    );
    // The client secret only ever goes into the token request body, never into the browser URL.
    expect(opened[0]).not.toContain('GOCSPX');
    expect(body.get('client_secret')).toBe('GOCSPX-secret-value');
  });

  it('requests the scopes of every chosen feature', async () => {
    await saveClient('testco', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['calendar', 'mail']);
    expect(new URL(opened[0]!).searchParams.get('scope')).toBe('cal.readonly mail.readonly');
  });

  it('asks for the client id first', async () => {
    const status = await connectOAuth(def, ['calendar']);
    expect(status.state).toBe('error');
    expect(status.message).toBe(describeError(new ConnectorError('not-configured')));
    expect(opened).toEqual([]);
  });

  it('treats a cancelled login as not connected, and a timeout as an error', async () => {
    await saveClient('testco', { clientId: 'client-abc-123' });
    waitOutcome = 'denied';
    expect((await connectOAuth(def, ['calendar'])).state).toBe('disconnected');
    waitOutcome = 'timeout';
    expect((await connectOAuth(def, ['calendar'])).state).toBe('error');
    expect(secrets.has('oauth:testco:refresh')).toBe(false);
  });

  it('an abandoned login stops waiting and stores no token, even if the browser finishes later', async () => {
    await saveClient('testco', { clientId: 'client-abc-123' });
    waitOutcome = 'pending';
    const controller = new AbortController();
    const before = await loadStatus('testco');
    const result = connectOAuth(def, ['calendar'], { signal: controller.signal });
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    controller.abort();
    // Resolves at once (does not wait for the browser) and leaves the status alone.
    expect(await result).toEqual(before);
    release(); // the user completes the login in the browser after the assistant was closed
    await new Promise((r) => setTimeout(r, 20));
    expect(tokenBodies).toHaveLength(0);
    expect(secrets.has('oauth:testco:refresh')).toBe(false);
    expect(await loadStatus('testco')).toEqual(before);
  });

  it('a login aborted before the browser opens does nothing at all', async () => {
    await saveClient('testco', { clientId: 'client-abc-123' });
    const controller = new AbortController();
    controller.abort();
    await connectOAuth(def, ['calendar'], { signal: controller.signal });
    expect(opened).toEqual([]);
    expect(secrets.has('oauth:testco:refresh')).toBe(false);
  });

  it('refuses without a refresh token in the answer', async () => {
    await saveClient('testco', { clientId: 'client-abc-123' });
    tokenResponse = () => jsonResponse(200, { access_token: 'AT', expires_in: 3600 });
    expect((await connectOAuth(def, ['calendar'])).state).toBe('error');
  });
});

describe('syncCalendars', () => {
  async function connected() {
    await saveClient('testco', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['calendar']);
  }

  it('copies the primary calendar into the calendar module and remembers the sync token', async () => {
    await connected();
    nextSync = () => ({
      events: [event('a', 'Zahnarzt'), event('b', 'Sport')],
      removedIds: [],
      nextSyncToken: 'T1',
      full: true,
    });
    const first = await syncCalendars(def);
    expect(first).toEqual({ added: 2, updated: 0, removed: 0 });
    const stored = await externalRepo.active().toArray();
    expect(stored.map((e) => e.title).sort()).toEqual(['Sport', 'Zahnarzt']);
    expect(stored[0]).toMatchObject({ source: 'testco', calendarId: 'primary', color: '#112233' });
    expect(syncCalls).toEqual([{ calendarId: 'primary', syncToken: undefined }]);

    // Second round: incremental with the token; unchanged etag = no write, cancelled event removed.
    nextSync = () => ({
      events: [event('b', 'Sport'), event('c', 'Neu')],
      removedIds: ['a'],
      nextSyncToken: 'T2',
      full: false,
    });
    const second = await syncCalendars(def);
    expect(second).toEqual({ added: 1, updated: 0, removed: 1 });
    expect(syncCalls[1]).toEqual({ calendarId: 'primary', syncToken: 'T1' });
    expect((await externalRepo.active().toArray()).map((e) => e.title).sort()).toEqual([
      'Neu',
      'Sport',
    ]);
    expect((await loadStatus('testco')).lastSyncAt).toBeGreaterThan(0);
  });

  it('a full window sync removes events that vanished, and a changed etag updates one', async () => {
    await connected();
    nextSync = () => ({
      events: [event('a', 'Alt'), event('b', 'Bleibt')],
      removedIds: [],
      full: true,
    });
    await syncCalendars(def);
    nextSync = () => ({ events: [event('b', 'Bleibt (neu)', 'e2')], removedIds: [], full: true });
    expect(await syncCalendars(def)).toEqual({ added: 0, updated: 1, removed: 1 });
    expect((await externalRepo.active().toArray()).map((e) => e.title)).toEqual(['Bleibt (neu)']);
  });

  it('brings a removed event back under the same record when it reappears', async () => {
    await connected();
    nextSync = () => ({ events: [event('a', 'Einmal')], removedIds: [], full: true });
    await syncCalendars(def);
    const [first] = await externalRepo.active().toArray();
    const id = first!.id;
    nextSync = () => ({ events: [], removedIds: [], full: true });
    await syncCalendars(def);
    expect(await externalRepo.active().count()).toBe(0);
    nextSync = () => ({ events: [event('a', 'Einmal')], removedIds: [], full: true });
    await syncCalendars(def);
    expect((await externalRepo.active().toArray()).map((e) => e.id)).toEqual([id]);
  });

  it('marks the connection expired when the provider revokes the refresh token', async () => {
    await connected();
    forgetAccessToken('testco');
    tokenResponse = () => jsonResponse(400, { error: 'invalid_grant' });
    await syncCalendars(def);
    const status = await loadStatus('testco');
    expect(status.state).toBe('expired');
    expect(status.message).toMatch(/abgelaufen/);
  });

  it('backs off on a rate limit and does not call again before retryAt', async () => {
    await connected();
    nextSync = () => {
      throw new ConnectorError('rate-limited', 'rate', 600);
    };
    await syncCalendars(def);
    const status = await loadStatus('testco');
    expect(status.state).toBe('rate-limited');
    expect(status.retryAt).toBe(new Date(2026, 8, 29, 10, 10).getTime());
    const calls = syncCalls.length;
    await syncCalendars(def);
    expect(syncCalls.length).toBe(calls);
    // ... and works again after the wait.
    setNow(() => new Date(2026, 8, 29, 10, 11).getTime());
    nextSync = () => ({ events: [], removedIds: [], full: true });
    await syncCalendars(def);
    expect((await loadStatus('testco')).state).toBe('connected');
  });

  it('never puts token text into the stored message', async () => {
    await connected();
    nextSync = () => {
      throw new ConnectorError('bad-response', 'x access_token=ya29.abcdefghijklmnop'); // gitleaks:allow (invented test value)
    };
    await syncCalendars(def);
    const status = await loadStatus('testco');
    expect(JSON.stringify(status)).not.toMatch(/ya29|access_token=/);
  });

  it('switching a calendar off removes its events', async () => {
    await connected();
    nextSync = () => ({ events: [event('a', 'Privat-Termin')], removedIds: [], full: true });
    await syncCalendars(def);
    await selectCalendars(def, ['work']);
    expect(await externalRepo.active().count()).toBe(0);
  });
});

describe('disconnect', () => {
  it('revokes the token, forgets local state and (optionally) the copied events', async () => {
    await saveClient('testco', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['calendar']);
    nextSync = () => ({
      events: [event('a', 'X')],
      removedIds: [],
      nextSyncToken: 'T',
      full: true,
    });
    await syncCalendars(def);

    await disconnect(def, { keepData: true });
    expect(revoked).toBe(1);
    expect(secrets.has('oauth:testco:refresh')).toBe(false);
    expect(await externalRepo.active().count()).toBe(1);
    expect((await loadStatus('testco')).state).toBe('disconnected');
    expect(await db.table('_meta').where('key').startsWith('connector.testco.').count()).toBe(0);

    await saveClient('testco', { clientId: 'client-abc-123' });
    await connectOAuth(def, ['calendar']);
    await disconnect(def, { keepData: false });
    expect(await externalRepo.active().count()).toBe(0);
  });
});
