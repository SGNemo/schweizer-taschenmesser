import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PASSWORD_OPTIONS, EXTENSION_ID, EXTENSION_ORIGIN } from '@nemo/vault-core';
import type { EntryData, EntryDraft } from '../schema';
import type { DecryptedEntry } from '../vault';
import {
  PAIRING_TTL_MS,
  SECRETS_PER_MINUTE,
  createBridgeHandler,
  type BridgeDeps,
  type BridgeHandler,
  type PendingPairing,
} from '../bridge/handler';

const entry = (id: string, url: string, over: Partial<EntryData> = {}): DecryptedEntry => ({
  id,
  createdAt: 0,
  updatedAt: 0,
  data: {
    title: `Konto ${id}`,
    username: `user-${id}@example.test`,
    password: `pw-${id}-geheim`, // gitleaks:allow (invented fixture)
    url,
    notes: 'private note',
    tags: [],
    favorite: false,
    ...over,
  },
});

interface Ctx {
  deps: BridgeDeps;
  handler: BridgeHandler;
  entries: DecryptedEntry[];
  saved: { draft: EntryDraft; id?: string }[];
  state: { unlocked: boolean; paired: boolean; time: number; mode: 'domain' | 'host' };
  pairing: (PendingPairing | null)[];
  call(op: string, body?: object, extra?: object): Promise<Reply>;
  session: string | undefined;
  seq: number;
}

interface Reply {
  ok: boolean;
  id: string;
  error?: string;
  data?: Record<string, unknown> & { entries?: Record<string, unknown>[] };
}

function setup(): Ctx {
  const ctx = {
    entries: [
      entry('1', 'https://example.com'),
      entry('2', 'https://accounts.example.org'),
      entry('3', 'http://intranet.local:8080', {
        totp: { secret: 'JBSWY3DPEHPK3PXP', issuer: '', digits: 6, period: 30, algorithm: 'SHA1' },
      }),
    ],
    saved: [] as Ctx['saved'],
    state: { unlocked: true, paired: true, time: 1_000_000, mode: 'domain' as const },
    pairing: [] as Ctx['pairing'],
    session: undefined as string | undefined,
    seq: 0,
  } as Ctx;
  let counter = 0;
  ctx.deps = {
    now: () => ctx.state.time,
    randomInt: () => 123456,
    randomToken: () => `session-token-${++counter}-abcdefghij`,
    isUnlocked: () => ctx.state.unlocked,
    originMode: async () => ctx.state.mode,
    generatorOptions: async () => DEFAULT_PASSWORD_OPTIONS,
    isPaired: async () => ctx.state.paired,
    addPaired: async () => {
      ctx.state.paired = true;
    },
    entries: async () => ctx.entries,
    save: async (draft, id) => {
      ctx.saved.push({ draft, id });
      return id ?? 'new-id';
    },
    onPairingChange: (p) => ctx.pairing.push(p),
  };
  ctx.handler = createBridgeHandler(ctx.deps);
  ctx.call = async (op, body = {}, extra = {}) => {
    const needsSession = !['hello', 'status'].includes(op);
    const message = {
      v: 1,
      id: crypto.randomUUID(),
      op,
      origin: EXTENSION_ORIGIN,
      body,
      ...(needsSession && ctx.session ? { session: ctx.session, seq: ++ctx.seq } : {}),
      ...extra,
    };
    return JSON.parse(await ctx.handler.handle(JSON.stringify(message))) as Reply;
  };
  return ctx;
}

async function connect(ctx: Ctx) {
  const hello = await ctx.call('hello');
  ctx.session = hello.data?.session as string;
  ctx.seq = 0;
  return hello;
}

let ctx: Ctx;
beforeEach(() => {
  ctx = setup();
});

describe('hello and pairing', () => {
  it('gives a paired extension a session while unlocked', async () => {
    const hello = await connect(ctx);
    expect(hello.data).toMatchObject({ state: 'unlocked' });
    expect(ctx.session).toMatch(/^session-token-/);
  });

  it('answers only the state while locked and creates no session', async () => {
    ctx.state.unlocked = false;
    const hello = await ctx.call('hello');
    expect(hello).toMatchObject({ ok: true, data: { state: 'locked' } });
    expect(hello.data?.session).toBeUndefined();
    expect((await ctx.call('status')).data).toEqual({ state: 'locked' });
  });

  it('asks the user to confirm an unpaired extension, with the same code every time', async () => {
    ctx.state.paired = false;
    const first = await ctx.call('hello');
    const second = await ctx.call('hello');
    expect(first.data).toEqual({ state: 'pairing', pairCode: '123456' });
    expect(second.data).toEqual(first.data);
    expect(ctx.pairing.filter(Boolean)).toHaveLength(1);
    expect(ctx.handler.pending()).toMatchObject({ extensionId: EXTENSION_ID, code: '123456' });
  });

  it('pairs only after the user confirmed, and then hands out a session', async () => {
    ctx.state.paired = false;
    await ctx.call('hello');
    expect((await ctx.call('match', { pageOrigin: 'https://example.com' })).error).toBeDefined();
    await ctx.handler.confirmPairing();
    expect(ctx.handler.pending()).toBeNull();
    expect((await connect(ctx)).data).toMatchObject({ state: 'unlocked' });
  });

  it('does not pair when the vault locked in between', async () => {
    ctx.state.paired = false;
    await ctx.call('hello');
    ctx.state.unlocked = false;
    await ctx.handler.confirmPairing();
    expect(ctx.state.paired).toBe(false);
  });

  it('a declined request is refused for a while, an expired one disappears', async () => {
    ctx.state.paired = false;
    await ctx.call('hello');
    ctx.handler.declinePairing();
    expect((await ctx.call('hello')).data).toEqual({ state: 'rejected' });
    ctx.state.time += 3 * 60_000;
    expect((await ctx.call('hello')).data).toMatchObject({ state: 'pairing' });
    ctx.state.time += PAIRING_TTL_MS + 1;
    expect(ctx.handler.pending()).toBeNull();
  });

  it('rejects every other extension id', async () => {
    const other = `chrome-extension://${'a'.repeat(32)}/`;
    const hello = await ctx.call('hello', {}, { origin: other });
    expect(hello.data).toEqual({ state: 'rejected' });
    await connect(ctx);
    const secret = await ctx.call(
      'secret',
      { entryId: '1', pageOrigin: 'https://example.com', field: 'password' },
      { origin: other },
    );
    expect(secret).toMatchObject({ ok: false, error: 'not-paired' });
  });
});

describe('message validation', () => {
  it.each([
    ['not json', 'nope'],
    ['an array', '[]'],
    [
      'unknown op',
      JSON.stringify({
        v: 1,
        id: crypto.randomUUID(),
        op: 'dump',
        origin: EXTENSION_ORIGIN,
        body: {},
      }),
    ],
    [
      'unknown field',
      JSON.stringify({
        v: 1,
        id: crypto.randomUUID(),
        op: 'hello',
        origin: EXTENSION_ORIGIN,
        body: {},
        extra: 1,
      }),
    ],
    [
      'unknown body field',
      JSON.stringify({
        v: 1,
        id: crypto.randomUUID(),
        op: 'match',
        origin: EXTENSION_ORIGIN,
        body: { pageOrigin: 'https://example.com', all: true },
      }),
    ],
    ['oversize', 'x'.repeat(70_000)],
  ])('answers %s with bad-request', async (_name, raw) => {
    const reply = JSON.parse(await ctx.handler.handle(raw)) as Reply;
    expect(reply).toMatchObject({ ok: false, error: 'bad-request' });
  });
});

describe('sessions, replay and locking', () => {
  beforeEach(() => connect(ctx));

  it('refuses a reused request id', async () => {
    const message = JSON.stringify({
      v: 1,
      id: crypto.randomUUID(),
      op: 'status',
      origin: EXTENSION_ORIGIN,
      body: {},
    });
    expect(JSON.parse(await ctx.handler.handle(message)).ok).toBe(true);
    expect(JSON.parse(await ctx.handler.handle(message))).toMatchObject({
      ok: false,
      error: 'replay',
    });
  });

  it('refuses a sequence number that does not increase', async () => {
    await ctx.call('genParams');
    ctx.seq = 0; // a replayed or reordered message
    expect(await ctx.call('genParams')).toMatchObject({ ok: false, error: 'replay' });
  });

  it('refuses requests without or with an unknown session', async () => {
    ctx.session = undefined;
    expect(await ctx.call('genParams')).toMatchObject({ ok: false, error: 'no-session' });
    ctx.session = 'x'.repeat(24);
    ctx.seq = 0;
    expect(await ctx.call('genParams')).toMatchObject({ ok: false, error: 'no-session' });
  });

  it('locking ends every session at once', async () => {
    expect((await ctx.call('genParams')).ok).toBe(true);
    ctx.state.unlocked = false;
    ctx.handler.endSessions();
    expect(await ctx.call('genParams')).toMatchObject({ ok: false, error: 'locked' });
    ctx.state.unlocked = true; // unlocked again: the old session is still gone
    expect(await ctx.call('genParams')).toMatchObject({ ok: false, error: 'no-session' });
  });

  it('a request that arrives after the lock never returns data', async () => {
    ctx.state.unlocked = false; // endSessions not called yet
    const reply = await ctx.call('match', { pageOrigin: 'https://example.com' });
    expect(reply).toMatchObject({ ok: false, error: 'locked' });
    expect(reply.data).toBeUndefined();
  });

  it('serves generator parameters', async () => {
    expect((await ctx.call('genParams')).data).toMatchObject({ length: 20, symbols: true });
  });
});

describe('origin matching', () => {
  beforeEach(() => connect(ctx));

  it('offers title, user name and url – never the password – for the matching origin only', async () => {
    const reply = await ctx.call('match', { pageOrigin: 'https://login.example.com' });
    expect(reply.data?.entries).toEqual([
      {
        id: '1',
        title: 'Konto 1',
        username: 'user-1@example.test',
        url: 'https://example.com',
        hasTotp: false,
      },
    ]);
    expect(JSON.stringify(reply)).not.toContain('geheim');
    expect(JSON.stringify(reply)).not.toContain('private note');
  });

  it.each([
    'https://example.com.evil.test',
    'https://evil-example.com',
    'https://examp1e.com',
    'http://example.com',
    'https://example.com:8443',
    'https://example.net', // other registrable domain
  ])('offers nothing on %s', async (page) => {
    const reply = await ctx.call('match', { pageOrigin: page });
    expect(reply.data?.entries).toEqual([]);
  });

  it('exact-host mode drops the subdomain match', async () => {
    ctx.state.mode = 'host';
    expect(
      (await ctx.call('match', { pageOrigin: 'https://login.example.com' })).data?.entries,
    ).toEqual([]);
    expect(
      (await ctx.call('match', { pageOrigin: 'https://example.com' })).data?.entries,
    ).toHaveLength(1);
  });

  it('reveals a secret only for the requested, matching entry', async () => {
    const reply = await ctx.call('secret', {
      entryId: '1',
      pageOrigin: 'https://example.com',
      field: 'password',
    });
    expect(reply.data).toEqual({ value: 'pw-1-geheim' });
  });

  it('refuses a secret for another origin, with a code only', async () => {
    const reply = await ctx.call('secret', {
      entryId: '1',
      pageOrigin: 'https://evil.test',
      field: 'password',
    });
    expect(reply).toMatchObject({ ok: false, error: 'origin-mismatch' });
    const text = JSON.stringify(reply);
    expect(text).not.toContain('evil.test');
    expect(text).not.toContain('geheim');
    expect(text).not.toContain('example.com');
  });

  it('refuses unknown entries', async () => {
    expect(
      await ctx.call('secret', {
        entryId: 'nope',
        pageOrigin: 'https://example.com',
        field: 'password',
      }),
    ).toMatchObject({ error: 'unknown-entry' });
  });

  it('delivers a TOTP code, and refuses one for an entry without TOTP', async () => {
    const ok = await ctx.call('secret', {
      entryId: '3',
      pageOrigin: 'http://intranet.local:8080',
      field: 'totp',
    });
    expect(ok.data?.value).toMatch(/^\d{6}$/);
    const none = await ctx.call('secret', {
      entryId: '1',
      pageOrigin: 'https://example.com',
      field: 'totp',
    });
    expect(none).toMatchObject({ ok: false, error: 'unknown-entry' });
  });

  it('limits how fast secrets can be pulled', async () => {
    const ask = () =>
      ctx.call('secret', { entryId: '1', pageOrigin: 'https://example.com', field: 'password' });
    for (let i = 0; i < SECRETS_PER_MINUTE; i++) expect((await ask()).ok).toBe(true);
    expect(await ask()).toMatchObject({ ok: false, error: 'rate-limited' });
    ctx.state.time += 61_000;
    expect((await ask()).ok).toBe(true);
  });
});

describe('writes', () => {
  beforeEach(() => connect(ctx));

  it('creates an entry through the normal save path, with the page origin as default url', async () => {
    const reply = await ctx.call('create', {
      title: 'Neuer Shop',
      username: 'alice@example.test',
      password: 'generiertes-passwort',
      url: '',
      pageOrigin: 'https://shop.example.net/signup?x=1',
    });
    expect(reply).toMatchObject({ ok: true, data: { id: 'new-id' } });
    expect(ctx.saved).toEqual([
      {
        draft: {
          title: 'Neuer Shop',
          username: 'alice@example.test',
          password: 'generiertes-passwort',
          url: 'https://shop.example.net',
          notes: '',
          tags: [],
          favorite: false,
        },
        id: undefined,
      },
    ]);
  });

  it('refuses to store a url that does not belong to the page', async () => {
    const reply = await ctx.call('create', {
      title: 'x',
      username: '',
      password: 'pw',
      url: 'https://bank.example.com',
      pageOrigin: 'https://evil.test',
    });
    expect(reply).toMatchObject({ ok: false, error: 'origin-mismatch' });
    expect(ctx.saved).toHaveLength(0);
  });

  it('updates only the password of a matching entry and keeps the rest', async () => {
    const reply = await ctx.call('update', {
      entryId: '1',
      password: 'neues-passwort',
      pageOrigin: 'https://example.com',
    });
    expect(reply.ok).toBe(true);
    expect(ctx.saved[0]?.id).toBe('1');
    expect(ctx.saved[0]?.draft).toMatchObject({
      password: 'neues-passwort',
      notes: 'private note',
      username: 'user-1@example.test',
    });
    const bad = await ctx.call('update', {
      entryId: '1',
      password: 'x',
      pageOrigin: 'https://evil.test',
    });
    expect(bad).toMatchObject({ ok: false, error: 'origin-mismatch' });
    expect(ctx.saved).toHaveLength(1);
  });

  it('compares a submitted password without revealing the stored one', async () => {
    const same = await ctx.call('compare', {
      entryId: '1',
      password: 'pw-1-geheim',
      pageOrigin: 'https://example.com',
    });
    const different = await ctx.call('compare', {
      entryId: '1',
      password: 'anders',
      pageOrigin: 'https://example.com',
    });
    expect(same.data).toEqual({ same: true });
    expect(different.data).toEqual({ same: false });
    expect(JSON.stringify(different)).not.toContain('geheim');
  });
});

describe('robustness', () => {
  it('never throws, and answers internal errors without a cause', async () => {
    const failing = createBridgeHandler({
      ...ctx.deps,
      entries: vi.fn().mockRejectedValue(new Error('secret-detail https://x.test')),
    });
    const message = (op: string, body: object, extra: object = {}) =>
      JSON.stringify({
        v: 1,
        id: crypto.randomUUID(),
        op,
        origin: EXTENSION_ORIGIN,
        body,
        ...extra,
      });
    const hello = JSON.parse(await failing.handle(message('hello', {})));
    const reply = JSON.parse(
      await failing.handle(
        message(
          'match',
          { pageOrigin: 'https://example.com' },
          { session: hello.data.session, seq: 1 },
        ),
      ),
    );
    expect(reply).toMatchObject({ ok: false, error: 'internal' });
    expect(JSON.stringify(reply)).not.toContain('secret-detail');
  });
});
