import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PENDING_TTL_MS, createBackground, pageOriginOf, type Deps } from '../src/lib/background';
import type { BridgeClient, CallResult, ConnectionState } from '../src/lib/bridgeClient';
import { requestSchema } from '../src/lib/messages';

interface Entry {
  id: string;
  title: string;
  username: string;
  url: string;
  hasTotp: boolean;
  password: string;
}

const entries: Entry[] = [
  {
    id: 'e1',
    title: 'Shop',
    username: 'alice@example.test',
    url: 'https://shop.example.test',
    hasTotp: true,
    password: 'pw-e1-geheim',
  }, // gitleaks:allow
];

interface Fake {
  state: ConnectionState;
  calls: { op: string; body: Record<string, unknown> }[];
  time: number;
  copied: string[];
  sent: unknown[];
  active: { id: number; url?: string } | undefined;
}

function setup() {
  const fake: Fake = {
    state: { state: 'unlocked' },
    calls: [],
    time: 1_000,
    copied: [],
    sent: [],
    active: { id: 7, url: 'https://shop.example.test/login' },
  };
  const client: BridgeClient = {
    connectState: async () => fake.state,
    hasSession: () => fake.state.state === 'unlocked',
    reset: () => undefined,
    async call(op, body): Promise<CallResult> {
      const b = body as Record<string, unknown>;
      fake.calls.push({ op, body: b });
      if (fake.state.state === 'locked') return { ok: false, error: 'locked' };
      if (fake.state.state === 'app-missing') return { ok: false, error: 'app-missing' };
      const origin = String(b.pageOrigin ?? '');
      const same = origin.includes('shop.example.test');
      switch (op) {
        case 'match':
          return {
            ok: true,
            data: { entries: same ? entries.map(({ password: _p, ...rest }) => rest) : [] },
          };
        case 'secret': {
          if (!same) return { ok: false, error: 'origin-mismatch' };
          return {
            ok: true,
            data: { value: b.field === 'totp' ? '123456' : entries[0]!.password },
          };
        }
        case 'create':
          return { ok: true, data: { id: 'new' } };
        case 'update':
          return { ok: true, data: { ok: true } };
        case 'compare':
          return { ok: true, data: { same: b.password === entries[0]!.password } };
        case 'genParams':
          return {
            ok: true,
            data: {
              length: 24,
              lower: true,
              upper: true,
              digits: true,
              symbols: false,
              avoidAmbiguous: true,
            },
          };
        default:
          return { ok: false, error: 'bad-request' };
      }
    },
  };
  const deps: Deps = {
    client,
    now: () => fake.time,
    copySecret: async (text) => void fake.copied.push(text),
    activeTab: async () => fake.active,
    sendToTab: async (tabId, frameId, command) => void fake.sent.push({ tabId, frameId, command }),
  };
  return { fake, bg: createBackground(deps) };
}

const tab = (url: string, id = 7) => ({ tabId: id, frameId: 0, origin: new URL(url).origin, url });

let ctx: ReturnType<typeof setup>;
beforeEach(() => {
  ctx = setup();
});

describe('page origin comes from the browser, never from a message', () => {
  it('normalises the sender origin and rejects non-web senders', () => {
    expect(pageOriginOf({ origin: 'https://Shop.Example.test:443' })).toBe(
      'https://shop.example.test',
    );
    expect(pageOriginOf({ url: 'chrome://settings' })).toBeUndefined();
    expect(pageOriginOf({})).toBeUndefined();
  });
  it('an opaque-origin frame (sandboxed iframe) gets no origin, never the URL as fallback', async () => {
    expect(pageOriginOf({ origin: 'null', url: 'https://a.test/x' })).toBeUndefined();
    const sandboxed = { tabId: 7, frameId: 3, origin: 'null', url: 'https://shop.example.test/' };
    expect(await ctx.bg.handle({ type: 'match' }, sandboxed)).toEqual({
      ok: false,
      error: 'bad-request',
    });
    expect(
      await ctx.bg.handle({ type: 'submitted', username: 'x', password: 'pw' }, sandboxed),
    ).toEqual({ ok: false, error: 'no-tab' });
    expect(ctx.fake.calls).toEqual([]);
  });
  it('the popup path still resolves the active tab by URL (no origin field)', () => {
    expect(pageOriginOf({ url: 'https://a.test/x' })).toBe('https://a.test');
  });
  it('match and secret use the sender origin; messages cannot carry another one', async () => {
    await ctx.bg.handle({ type: 'match' }, tab('https://shop.example.test/login'));
    expect(ctx.fake.calls[0]).toEqual({
      op: 'match',
      body: { pageOrigin: 'https://shop.example.test' },
    });
    const parsed = requestSchema.safeParse({ type: 'match', pageOrigin: 'https://evil.test' });
    expect(parsed.success).toBe(false);
  });
  it('a look-alike page gets origin-mismatch, never a password', async () => {
    const r = await ctx.bg.handle(
      { type: 'secret', entryId: 'e1', field: 'password' },
      tab('https://shop-example.test/login'),
    );
    expect(r).toEqual({ ok: false, error: 'origin-mismatch' });
  });
  it('refuses a sender without a web origin', async () => {
    expect(await ctx.bg.handle({ type: 'match' }, { tabId: 1, url: 'about:blank' })).toEqual({
      ok: false,
      error: 'bad-request',
    });
  });
});

describe('states are reported, no data while locked or missing', () => {
  it('status passes the connection state through', async () => {
    ctx.fake.state = { state: 'pairing', pairCode: '123456' };
    expect(await ctx.bg.handle({ type: 'status' }, {})).toEqual({
      ok: true,
      data: { state: 'pairing', pairCode: '123456' },
    });
  });
  it.each(['locked', 'app-missing'] as const)('%s → failure, no entries', async (state) => {
    ctx.fake.state = { state };
    const r = await ctx.bg.handle({ type: 'match' }, tab('https://shop.example.test/'));
    expect(r).toEqual({ ok: false, error: state });
    const popup = await ctx.bg.handle({ type: 'popup-state' }, {});
    expect(popup).toMatchObject({ ok: true, data: { entries: [] } });
  });
});

describe('generating', () => {
  it('makes a password locally and adopts the app defaults when connected', async () => {
    const g = await ctx.bg.handle({ type: 'generate' }, {});
    expect(g).toMatchObject({
      ok: true,
      data: { settings: { password: { length: 24, symbols: false } } },
    });
    expect((g as { data: { value: string } }).data.value).toHaveLength(24);
  });
  it('works without the app and keeps user settings', async () => {
    ctx.fake.state = { state: 'app-missing' };
    const custom = {
      mode: 'passphrase' as const,
      password: {
        length: 20,
        lower: true,
        upper: true,
        digits: true,
        symbols: true,
        avoidAmbiguous: false,
      },
      passphrase: { words: 4, separator: '.', capitalize: false, includeNumber: false },
    };
    const g = await ctx.bg.handle({ type: 'generate', settings: custom }, {});
    expect((g as { data: { value: string } }).data.value.split('.')).toHaveLength(4);
  });
});

describe('saving a generated password', () => {
  it('keeps the password in the service worker, shows the page only title and user', async () => {
    const s = tab('https://shop.example.test/signup');
    await ctx.bg.handle(
      { type: 'pending-set', title: 'Shop', username: 'bob@example.test', password: 'Gen3riert!' },
      s,
    );
    const got = await ctx.bg.handle(
      { type: 'pending-get' },
      tab('https://shop.example.test/welcome'),
    );
    expect(got).toEqual({
      ok: true,
      data: {
        kind: 'save',
        title: 'Shop',
        username: 'bob@example.test',
        origin: 'https://shop.example.test',
      },
    });
    expect(JSON.stringify(got)).not.toContain('Gen3riert');
  });
  it('is offered only on the same site and only in the same tab', async () => {
    await ctx.bg.handle(
      { type: 'pending-set', title: 'Shop', username: '', password: 'x' },
      tab('https://shop.example.test/'),
    );
    expect(await ctx.bg.handle({ type: 'pending-get' }, tab('https://evil.test/'))).toEqual({
      ok: true,
      data: null,
    });
    expect(
      await ctx.bg.handle({ type: 'pending-get' }, tab('https://shop.example.test/', 8)),
    ).toEqual({ ok: true, data: null });
  });
  it('saves through the app with the page origin and clears the pending data', async () => {
    const s = tab('https://shop.example.test/signup');
    await ctx.bg.handle(
      { type: 'pending-set', title: 'Shop', username: 'bob@example.test', password: 'Gen3riert!' },
      s,
    );
    const r = await ctx.bg.handle({ type: 'pending-save', username: 'bob2@example.test' }, s);
    expect(r).toMatchObject({ ok: true });
    expect(ctx.fake.calls.at(-1)).toEqual({
      op: 'create',
      body: {
        title: 'Shop',
        username: 'bob2@example.test',
        password: 'Gen3riert!',
        url: '',
        pageOrigin: 'https://shop.example.test',
      },
    });
    expect(ctx.bg.pendingCount()).toBe(0);
  });
  it('keeps the data for a retry when the app is locked', async () => {
    const s = tab('https://shop.example.test/signup');
    await ctx.bg.handle({ type: 'pending-set', title: 'Shop', username: 'b', password: 'p' }, s);
    ctx.fake.state = { state: 'locked' };
    expect(await ctx.bg.handle({ type: 'pending-save' }, s)).toEqual({
      ok: false,
      error: 'locked',
    });
    expect(ctx.bg.pendingCount()).toBe(1);
    ctx.fake.state = { state: 'unlocked' };
    expect(await ctx.bg.handle({ type: 'pending-save' }, s)).toMatchObject({ ok: true });
  });
  it('drops data when the tab closes or after five minutes', async () => {
    const s = tab('https://shop.example.test/signup');
    await ctx.bg.handle({ type: 'pending-set', title: 'Shop', username: '', password: 'p' }, s);
    ctx.bg.tabClosed(7);
    expect(ctx.bg.pendingCount()).toBe(0);
    await ctx.bg.handle({ type: 'pending-set', title: 'Shop', username: '', password: 'p' }, s);
    ctx.fake.time += PENDING_TTL_MS + 1;
    expect(await ctx.bg.handle({ type: 'pending-get' }, s)).toEqual({ ok: true, data: null });
  });
  it('an explicit discard clears it', async () => {
    const s = tab('https://shop.example.test/signup');
    await ctx.bg.handle({ type: 'pending-set', title: 'Shop', username: '', password: 'p' }, s);
    await ctx.bg.handle({ type: 'pending-clear' }, s);
    expect(ctx.bg.pendingCount()).toBe(0);
  });
});

describe('submitted forms', () => {
  const login = tab('https://shop.example.test/login');
  it('offers to save an unknown login', async () => {
    const r = await ctx.bg.handle(
      { type: 'submitted', username: 'new@example.test', password: 'pw' },
      login,
    );
    expect(r).toMatchObject({ ok: true, data: { kind: 'save', username: 'new@example.test' } });
  });
  it('stays quiet for a known login with the same password', async () => {
    const r = await ctx.bg.handle(
      { type: 'submitted', username: 'alice@example.test', password: entries[0]!.password },
      login,
    );
    expect(r).toEqual({ ok: true, data: null });
    expect(ctx.bg.pendingCount()).toBe(0);
  });
  it('offers an update for a known login with another password', async () => {
    const r = await ctx.bg.handle(
      { type: 'submitted', username: 'Alice@Example.test', password: 'neu' },
      login,
    );
    expect(r).toMatchObject({ ok: true, data: { kind: 'update', title: 'Shop' } });
    await ctx.bg.handle({ type: 'pending-save' }, login);
    expect(ctx.fake.calls.at(-1)).toEqual({
      op: 'update',
      body: { entryId: 'e1', password: 'neu', pageOrigin: 'https://shop.example.test' },
    });
  });
  it('does not offer twice for a password the user already chose via the suggestion', async () => {
    await ctx.bg.handle(
      { type: 'pending-set', title: 'Shop', username: 'x', password: 'pw' },
      login,
    );
    const before = ctx.fake.calls.length;
    expect(
      await ctx.bg.handle({ type: 'submitted', username: 'x', password: 'pw' }, login),
    ).toEqual({ ok: true, data: null });
    expect(ctx.fake.calls.length).toBe(before);
  });
  it('keeps the data in memory when the app is closed, for a later retry', async () => {
    ctx.fake.state = { state: 'app-missing' };
    const r = await ctx.bg.handle({ type: 'submitted', username: 'u', password: 'p' }, login);
    expect(r).toMatchObject({ ok: true, data: { kind: 'save' } });
    expect(ctx.bg.pendingCount()).toBe(1);
  });
});

describe('popup actions', () => {
  it('lists the entries of the active tab only', async () => {
    const r = await ctx.bg.handle({ type: 'popup-state' }, {});
    expect(r).toMatchObject({
      ok: true,
      data: { origin: 'https://shop.example.test', entries: [{ id: 'e1', title: 'Shop' }] },
    });
    expect(JSON.stringify(r)).not.toContain('geheim');
  });
  it('fills through the content script of the top frame with the origin of the tab', async () => {
    await ctx.bg.handle({ type: 'popup-fill', entryId: 'e1' }, {});
    expect(ctx.fake.sent).toEqual([
      {
        tabId: 7,
        frameId: 0,
        command: {
          type: 'do-fill',
          username: 'alice@example.test',
          password: entries[0]!.password,
        },
      },
    ]);
  });
  it('refuses to fill an entry that is not offered for this tab', async () => {
    ctx.fake.active = { id: 7, url: 'https://shop-example.test/login' };
    expect(await ctx.bg.handle({ type: 'popup-fill', entryId: 'e1' }, {})).toEqual({
      ok: false,
      error: 'unknown-entry',
    });
    expect(ctx.fake.sent).toEqual([]);
  });
  it('copies through the 30 s clipboard, never back to the popup', async () => {
    const r = await ctx.bg.handle({ type: 'popup-copy', entryId: 'e1', field: 'totp' }, {});
    expect(r).toEqual({ ok: true, data: null });
    expect(ctx.fake.copied).toEqual(['123456']);
    await ctx.bg.handle({ type: 'popup-copy', entryId: 'e1', field: 'username' }, {});
    expect(ctx.fake.copied.at(-1)).toBe('alice@example.test');
  });
  it('has no tab on a non-web page', async () => {
    ctx.fake.active = { id: 1, url: 'chrome://extensions' };
    expect(await ctx.bg.handle({ type: 'popup-fill', entryId: 'e1' }, {})).toEqual({
      ok: false,
      error: 'no-tab',
    });
  });
});

describe('message schema', () => {
  it('rejects unknown types and fields', () => {
    expect(requestSchema.safeParse({ type: 'dump' }).success).toBe(false);
    expect(requestSchema.safeParse({ type: 'status', extra: 1 }).success).toBe(false);
    expect(requestSchema.safeParse({ type: 'secret', entryId: 'e', field: 'notes' }).success).toBe(
      false,
    );
    expect(
      requestSchema.safeParse({ type: 'create', title: '', username: '', password: 'x' }).success,
    ).toBe(false);
  });
});

void vi;
