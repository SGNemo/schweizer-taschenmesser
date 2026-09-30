import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import type { DueNotification } from '@/core/modules/types';
import { decryptValue, deriveKey, isEncrypted, newSalt } from '@/core/sync/crypto';
import { createTestDb } from '@/test-utils';
import {
  buildSchedule,
  createPushRemote,
  disablePush,
  enablePush,
  PushError,
  pushStatus,
  sendTestPush,
  syncPushSchedule,
  type PushDeps,
  type PushRemote,
} from './push';
import { asPayload, parsePushMessage, pushAad } from './pushPayload';

const NOW = 1_000_000_000_000;
const SERVER_KEY = // gitleaks:allow (test fixture)
  'BPiEAmDbB0m_4GcXhIYVHW0qKzUgCWyZ3wkzp_2FjG3E3Nl4TGcCZ8Xy7yqJCpLQ2oWc0QyVN5hV3DPrfgO5U3o'; // gitleaks:allow (test fixture)
const due = (key: string, at: number, over: Partial<DueNotification> = {}): DueNotification => ({
  key,
  at,
  title: `T ${key}`,
  ...over,
});

interface Fakes {
  deps: PushDeps;
  remote: { [K in keyof PushRemote]: ReturnType<typeof vi.fn> };
  sub: { endpoint: string; unsubscribe: ReturnType<typeof vi.fn>; toJSON: () => unknown };
  pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
  state: { permission: NotificationPermission; due: DueNotification[] };
}

let database: TaschenmesserDB;

async function connect(extra: Record<string, unknown> = {}) {
  await database.table('_secrets').put({
    key: 'syncConfig',
    value: { kind: 'selfHosted', url: 'https://sync.example.test', token: 't', ...extra },
  });
}

function fakes(
  over: Partial<{ supported: boolean; permission: NotificationPermission; existing: boolean }> = {},
): Fakes {
  const state = {
    permission: over.permission ?? ('default' as NotificationPermission),
    due: [] as DueNotification[],
  };
  const sub = {
    endpoint: 'https://push.example.test/abc',
    unsubscribe: vi.fn(async () => true),
    toJSON: () => ({
      endpoint: 'https://push.example.test/abc',
      keys: { p256dh: 'k'.repeat(20), auth: 'a'.repeat(10) },
    }),
  };
  const pushManager = {
    getSubscription: vi.fn(async () => (over.existing ? sub : null)),
    subscribe: vi.fn(async () => sub),
  };
  const remote = {
    getKey: vi.fn(async () => SERVER_KEY),
    putSubscription: vi.fn(async () => undefined),
    unsubscribe: vi.fn(async () => undefined),
    putSchedule: vi.fn(async () => true),
    test: vi.fn(async () => true),
  };
  const deps: PushDeps = {
    database,
    now: () => NOW,
    supported: () => over.supported ?? true,
    permission: () => state.permission,
    requestPermission: async () => {
      state.permission = 'granted';
      return state.permission;
    },
    registration: async () => ({ pushManager }) as never,
    remote: () => remote as unknown as PushRemote,
    loadDue: async () => state.due,
  };
  return { deps, remote, sub, pushManager, state };
}

beforeEach(() => {
  database = createTestDb();
});

describe('payload helpers', () => {
  it('parses messages and payloads defensively', () => {
    expect(parsePushMessage('{"v":1,"key":"k","payload":"p"}')).toEqual({
      v: 1,
      key: 'k',
      payload: 'p',
    });
    for (const bad of [
      '',
      'nope',
      '{"v":2,"key":"k","payload":"p"}',
      '{"v":1,"key":1,"payload":"p"}',
    ]) {
      expect(parsePushMessage(bad), bad).toBeUndefined();
    }
    expect(asPayload({ title: 'A', body: 'B', url: '/x' })).toEqual({
      title: 'A',
      body: 'B',
      url: '/x',
    });
    expect(asPayload({ title: 'A', url: 'https://evil.example' })?.url).toBeUndefined(); // in-app paths only
    expect(asPayload({ title: '' })).toBeUndefined();
    expect(asPayload(null)).toBeUndefined();
    expect(asPayload('x')).toBeUndefined();
  });
});

describe('buildSchedule', () => {
  it('keeps future items once, in time order, plain JSON without a key', async () => {
    const items = await buildSchedule(
      [
        due('b', NOW + 2000, { body: 'x', url: '/invoices' }),
        due('a', NOW + 1000),
        due('a', NOW + 1500),
        due('past', NOW - 1),
      ],
      NOW,
    );
    expect(items.map((i) => i.key)).toEqual(['a', 'b']);
    expect(JSON.parse(items[1]!.payload)).toEqual({ title: 'T b', body: 'x', url: '/invoices' });
    expect(items[0]!.at).toBe(NOW + 1000);
  });

  it('caps the schedule at 500 items', async () => {
    const many = Array.from({ length: 700 }, (_, i) => due(`k${i}`, NOW + 1 + i));
    expect(await buildSchedule(many, NOW)).toHaveLength(500);
  });

  it('encrypts payloads with the sync key, bound to the notification key', async () => {
    const key = await deriveKey('correct horse battery', newSalt(), 1000);
    const [item] = await buildSchedule([due('rem:1', NOW + 5, { body: 'geheim' })], NOW, key);
    expect(isEncrypted(item!.payload)).toBe(true);
    expect(item!.payload).not.toContain('geheim');
    expect(await decryptValue(key, pushAad('rem:1'), item!.payload)).toEqual({
      title: 'T rem:1',
      body: 'geheim',
      url: undefined,
    });
    await expect(decryptValue(key, pushAad('rem:2'), item!.payload)).rejects.toThrow(); // swapped key
  });
});

describe('push status', () => {
  it('reports each precondition', async () => {
    expect(await pushStatus(fakes({ supported: false }).deps)).toEqual({ state: 'unsupported' });
    expect(await pushStatus(fakes().deps)).toEqual({ state: 'needs-sync' });
    await connect();
    expect(await pushStatus(fakes({ permission: 'denied' }).deps)).toEqual({ state: 'denied' });
    expect(await pushStatus(fakes().deps)).toEqual({ state: 'off' });
  });
});

describe('enable / disable', () => {
  it('needs support, a sync connection and permission', async () => {
    await expect(enablePush(fakes({ supported: false }).deps)).rejects.toMatchObject({
      code: 'unsupported',
    });
    await expect(enablePush(fakes().deps)).rejects.toMatchObject({ code: 'needs-sync' });
    await connect();
    const f = fakes({ permission: 'denied' });
    await expect(enablePush(f.deps)).rejects.toMatchObject({ code: 'denied' });
    expect(f.remote.getKey).not.toHaveBeenCalled();
  });

  it('asks for permission, subscribes with the server key, registers it and uploads the schedule', async () => {
    await connect();
    const f = fakes();
    f.state.due = [due('a', NOW + 60_000)];
    await enablePush(f.deps);

    const options = f.pushManager.subscribe.mock.calls[0]![0] as {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array;
    };
    expect(options.userVisibleOnly).toBe(true);
    expect(options.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(options.applicationServerKey.length).toBe(65); // uncompressed P-256 point
    expect(f.remote.putSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: f.sub.endpoint }),
    );
    expect(f.remote.putSchedule).toHaveBeenCalledWith(f.sub.endpoint, [
      expect.objectContaining({ key: 'a' }),
    ]);
    expect(await pushStatus(f.deps)).toEqual({ state: 'on', endpoint: f.sub.endpoint });
  });

  it('replaces a subscription that was made for another server key', async () => {
    await connect();
    await database
      .table('_secrets')
      .put({ key: 'pushConfig', value: { endpoint: 'old', serverKey: 'OLD' } });
    const f = fakes({ existing: true, permission: 'granted' });
    await enablePush(f.deps);
    expect(f.sub.unsubscribe).toHaveBeenCalled();
    expect(f.pushManager.subscribe).toHaveBeenCalled();
  });

  it('reuses a matching subscription', async () => {
    await connect();
    await database
      .table('_secrets')
      .put({ key: 'pushConfig', value: { endpoint: 'x', serverKey: SERVER_KEY } });
    const f = fakes({ existing: true, permission: 'granted' });
    await enablePush(f.deps);
    expect(f.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('reports a failing browser subscription', async () => {
    await connect();
    const f = fakes({ permission: 'granted' });
    f.pushManager.subscribe.mockRejectedValue(new Error('push service unavailable'));
    await expect(enablePush(f.deps)).rejects.toMatchObject({ code: 'subscribe-failed' });
    expect(await pushStatus(f.deps)).toEqual({ state: 'off' });
  });

  it('disabling clears the local state even when the server is unreachable', async () => {
    await connect();
    const f = fakes({ permission: 'granted' });
    await enablePush(f.deps);
    f.pushManager.getSubscription.mockResolvedValue(f.sub);
    f.remote.unsubscribe.mockRejectedValue(new PushError('network'));
    await disablePush(f.deps);
    expect(f.sub.unsubscribe).toHaveBeenCalled();
    expect(await pushStatus(f.deps)).toEqual({ state: 'off' });
  });

  it('sends a test message through the server', async () => {
    await connect();
    const f = fakes({ permission: 'granted' });
    await enablePush(f.deps);
    expect(await sendTestPush(f.deps)).toBe(true);
    expect(f.remote.test).toHaveBeenCalledWith(f.sub.endpoint);
  });
});

describe('schedule upload', () => {
  it('does nothing while push is off', async () => {
    await connect();
    const f = fakes();
    expect(await syncPushSchedule(f.deps)).toBe(false);
    expect(f.remote.putSchedule).not.toHaveBeenCalled();
  });

  it('registers the subscription again when the server forgot it', async () => {
    await connect();
    const f = fakes({ permission: 'granted' });
    await enablePush(f.deps);
    f.remote.putSubscription.mockClear();
    f.pushManager.getSubscription.mockResolvedValue(f.sub);
    f.remote.putSchedule.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await syncPushSchedule(f.deps)).toBe(true);
    expect(f.remote.putSubscription).toHaveBeenCalledTimes(1);
    expect(f.remote.putSchedule).toHaveBeenCalledTimes(3); // enable + rejected + retried
  });

  it('encrypts the payloads when end-to-end encryption is on', async () => {
    const key = await deriveKey('correct horse battery', newSalt(), 1000);
    await connect({ key });
    const f = fakes({ permission: 'granted' });
    f.state.due = [due('a', NOW + 60_000, { body: 'geheim' })];
    await enablePush(f.deps);
    const items = f.remote.putSchedule.mock.calls.at(-1)![1] as { payload: string }[];
    expect(isEncrypted(items[0]!.payload)).toBe(true);
  });
});

describe('remote', () => {
  const res = (status: number, body: unknown = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('talks to the sync server with the bearer token', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => res(200, { publicKey: 'PK' }));
    const remote = createPushRemote(
      { url: 'https://sync.example.test/', token: 'secret-token' },
      fetchMock as unknown as typeof fetch,
    );
    expect(await remote.getKey()).toBe('PK');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sync.example.test/v1/push/key');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret-token');

    await remote.putSchedule('https://p/1', [{ key: 'k', at: 1, payload: 'x' }]);
    const [scheduleUrl, scheduleInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(scheduleUrl).toBe('https://sync.example.test/v1/push/schedule');
    expect(scheduleInit.method).toBe('PUT');
    expect(JSON.parse(scheduleInit.body as string)).toEqual({
      endpoint: 'https://p/1',
      items: [{ key: 'k', at: 1, payload: 'x' }],
    });
  });

  it('maps failures to error codes', async () => {
    const remoteFor = (f: () => Promise<Response>) =>
      createPushRemote({ url: 'https://s.test', token: 't' }, f as unknown as typeof fetch);
    await expect(remoteFor(async () => res(401)).getKey()).rejects.toMatchObject({
      code: 'unauthorized',
    });
    await expect(remoteFor(async () => res(500)).getKey()).rejects.toMatchObject({
      code: 'server',
    });
    await expect(
      remoteFor(async () => {
        throw new TypeError('Failed to fetch');
      }).getKey(),
    ).rejects.toMatchObject({ code: 'network' });
    expect(await remoteFor(async () => res(404)).putSchedule('e', [])).toBe(false);
    expect(await remoteFor(async () => res(502)).test('e')).toBe(false);
    expect(await remoteFor(async () => res(200, { sent: true })).test('e')).toBe(true);
  });
});
