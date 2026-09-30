import { createECDH, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPushService,
  ensureVapidKeys,
  generateVapidKeys,
  padPrivateKey,
  MAX_ATTEMPTS,
  requestOptions,
  type PushSender,
} from '../src/push.js';
import { openStore, type Store } from '../src/store.js';
import { auth, setup } from './helpers.js';

const ENDPOINT = 'https://push.example.test/send/abc123';
const subscription = {
  endpoint: ENDPOINT,
  keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) },
};

let app: FastifyInstance;
let store: Store;
let sent: { endpoint: string; body: string }[];
let sender: PushSender & { fail?: (e: unknown) => void };
let failWith: unknown;

beforeEach(async () => {
  sent = [];
  failWith = undefined;
  sender = {
    async send(target, body) {
      if (failWith) throw failWith;
      sent.push({ endpoint: target.endpoint, body });
    },
  };
  ({ app, store } = await setup({ pushSender: sender }));
});
afterEach(async () => {
  await app.close();
  store.close();
});

const put = (url: string, payload: unknown, headers: Record<string, string> = auth) =>
  app.inject({ method: 'PUT', url, headers, payload: payload as object });
const post = (url: string, payload: unknown, headers: Record<string, string> = auth) =>
  app.inject({ method: 'POST', url, headers, payload: payload as object });
const subscribe = () => put('/v1/push/subscription', subscription);
const schedule = (items: { key: string; at: number; payload: string }[]) =>
  put('/v1/push/schedule', { endpoint: ENDPOINT, items });

describe('push API', () => {
  it('needs the bearer token', async () => {
    for (const [method, url] of [
      ['GET', '/v1/push/key'],
      ['PUT', '/v1/push/subscription'],
      ['POST', '/v1/push/unsubscribe'],
      ['PUT', '/v1/push/schedule'],
      ['POST', '/v1/push/test'],
    ] as const) {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('hands out the VAPID public key, generated once and kept', async () => {
    const first = (await app.inject({ method: 'GET', url: '/v1/push/key', headers: auth })).json<{
      publicKey: string;
    }>();
    expect(first.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/); // 65 bytes, base64url
    expect(store.vapid()?.publicKey).toBe(first.publicKey);
    const second = (await app.inject({ method: 'GET', url: '/v1/push/key', headers: auth })).json<{
      publicKey: string;
    }>();
    expect(second.publicKey).toBe(first.publicKey);
    expect(JSON.stringify(first)).not.toContain(store.vapid()!.privateKey);
  });

  it('validates subscriptions', async () => {
    expect((await subscribe()).statusCode).toBe(200);
    expect(store.getSubscription(ENDPOINT)).toMatchObject({ p256dh: subscription.keys.p256dh });
    for (const bad of [
      { ...subscription, endpoint: 'http://push.example.test/x' }, // https only
      { ...subscription, endpoint: 'not a url' },
      { endpoint: ENDPOINT },
      { ...subscription, keys: { p256dh: 'x', auth: 'y' } },
      { ...subscription, extra: 1 },
    ]) {
      expect((await put('/v1/push/subscription', bad)).statusCode, JSON.stringify(bad)).toBe(400);
    }
  });

  it('a resubscribe updates the keys instead of duplicating', async () => {
    await subscribe();
    await put('/v1/push/subscription', {
      ...subscription,
      keys: { p256dh: 'C'.repeat(87), auth: 'b'.repeat(22) },
    });
    expect(store.getSubscription(ENDPOINT)?.auth).toBe('b'.repeat(22));
  });

  it('only accepts a schedule for a known subscription', async () => {
    expect((await schedule([{ key: 'k', at: 1, payload: '{}' }])).statusCode).toBe(404);
  });

  it('replaces the schedule: whatever is no longer listed will not fire', async () => {
    await subscribe();
    expect(
      (
        await schedule([
          { key: 'a', at: 100, payload: 'A' },
          { key: 'b', at: 200, payload: 'B' },
        ])
      ).json(),
    ).toEqual({ stored: 2 });
    await schedule([
      { key: 'b', at: 250, payload: 'B2' },
      { key: 'c', at: 300, payload: 'C' },
    ]);
    expect(store.dueItems(10_000, 10).map((i) => [i.key, i.at, i.payload])).toEqual([
      ['b', 250, 'B2'],
      ['c', 300, 'C'],
    ]);
    await schedule([]);
    expect(store.dueItems(10_000, 10)).toEqual([]);
  });

  it('limits size and count', async () => {
    await subscribe();
    const many = Array.from({ length: 501 }, (_, i) => ({ key: `k${i}`, at: 1, payload: 'x' }));
    expect((await schedule(many)).statusCode).toBe(400);
    expect((await schedule([{ key: 'k', at: 1, payload: 'x'.repeat(4001) }])).statusCode).toBe(400);
    expect((await schedule([{ key: 'k', at: -1, payload: 'x' }])).statusCode).toBe(400);
    expect((await schedule([{ key: 'k', at: 1.5, payload: 'x' }])).statusCode).toBe(400);
  });

  it('unsubscribing removes the subscription and its schedule', async () => {
    await subscribe();
    await schedule([{ key: 'a', at: 1, payload: 'A' }]);
    expect((await post('/v1/push/unsubscribe', { endpoint: ENDPOINT })).statusCode).toBe(200);
    expect(store.getSubscription(ENDPOINT)).toBeUndefined();
    expect(store.dueItems(10, 10)).toEqual([]);
  });

  it('sends a test message right away', async () => {
    expect((await post('/v1/push/test', { endpoint: ENDPOINT })).statusCode).toBe(404);
    await subscribe();
    expect((await post('/v1/push/test', { endpoint: ENDPOINT })).json()).toEqual({ sent: true });
    const message = JSON.parse(sent[0]!.body) as { v: number; key: string; payload: string };
    expect(message).toMatchObject({ v: 1, key: 'test' });
    expect(JSON.parse(message.payload)).toMatchObject({ title: 'Nemo' });

    failWith = Object.assign(new Error('gone'), { statusCode: 410 });
    expect((await post('/v1/push/test', { endpoint: ENDPOINT })).statusCode).toBe(502);
    expect(store.getSubscription(ENDPOINT)).toBeUndefined(); // dead subscription cleaned up
  });

  it('reports that push is unavailable without a sender', async () => {
    const plain = await setup();
    await plain.app.inject({
      method: 'PUT',
      url: '/v1/push/subscription',
      headers: auth,
      payload: subscription,
    });
    const res = await plain.app.inject({
      method: 'POST',
      url: '/v1/push/test',
      headers: auth,
      payload: { endpoint: ENDPOINT },
    });
    expect(res.statusCode).toBe(503);
    await plain.app.close();
    plain.store.close();
  });

  it('a data reset drops schedules but keeps subscriptions', async () => {
    await subscribe();
    await schedule([{ key: 'a', at: 1, payload: 'A' }]);
    await post('/v1/reset', { confirm: 'RESET' });
    expect(store.dueItems(10, 10)).toEqual([]);
    expect(store.getSubscription(ENDPOINT)).toBeDefined();
  });
});

describe('push service', () => {
  const NOW = 1_000_000_000_000;
  let clock = NOW;
  const service = () => createPushService({ store, sender, now: () => clock });

  beforeEach(async () => {
    clock = NOW;
    await subscribe();
  });

  it('sends what is due exactly once, in order', async () => {
    await schedule([
      { key: 'later', at: NOW + 60_000, payload: 'L' },
      { key: 'due2', at: NOW - 1000, payload: 'D2' },
      { key: 'due1', at: NOW - 5000, payload: 'D1' },
    ]);
    const svc = service();
    expect(await svc.tick()).toBe(2);
    expect(sent.map((s) => JSON.parse(s.body).key)).toEqual(['due1', 'due2']);
    expect(await svc.tick()).toBe(0);
    clock = NOW + 61_000;
    expect(await svc.tick()).toBe(1);
    expect(sent.map((s) => JSON.parse(s.body).key)).toEqual(['due1', 'due2', 'later']);
  });

  it('wraps the opaque payload without looking into it', async () => {
    await schedule([{ key: 'k', at: NOW - 1, payload: 'enc:v1:abc:def' }]);
    await service().tick();
    expect(JSON.parse(sent[0]!.body)).toEqual({ v: 1, key: 'k', payload: 'enc:v1:abc:def' });
  });

  it('does not send an item again when a stale schedule is uploaded afterwards', async () => {
    await schedule([{ key: 'k', at: NOW - 1, payload: 'x' }]);
    await service().tick();
    await schedule([
      { key: 'k', at: NOW - 1, payload: 'x' },
      { key: 'j', at: NOW + 1, payload: 'y' },
    ]);
    expect(store.dueItems(NOW + 10, 10).map((i) => i.key)).toEqual(['j']);
  });

  it('drops a subscription the push service reports as gone (404/410)', async () => {
    await schedule([{ key: 'k', at: NOW - 1, payload: 'x' }]);
    failWith = Object.assign(new Error('gone'), { statusCode: 410 });
    expect(await service().tick()).toBe(0);
    expect(store.getSubscription(ENDPOINT)).toBeUndefined();
    expect(store.dueItems(NOW + 10, 10)).toEqual([]);
  });

  it('retries transient failures a few times, then gives up', async () => {
    await schedule([{ key: 'k', at: NOW - 1, payload: 'x' }]);
    failWith = new Error('temporarily unavailable');
    const svc = service();
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      await svc.tick();
      expect(store.dueItems(NOW + 10, 10)).toHaveLength(1);
    }
    await svc.tick();
    expect(store.dueItems(NOW + 10, 10)).toEqual([]);
    expect(store.getSubscription(ENDPOINT)).toBeDefined(); // a flaky push service is not a dead subscription

    failWith = undefined;
    await schedule([{ key: 'k2', at: NOW - 1, payload: 'y' }]);
    expect(await svc.tick()).toBe(1);
  });

  it('skips notifications that are more than a day late', async () => {
    await schedule([
      { key: 'old', at: NOW - 25 * 3600_000, payload: 'x' },
      { key: 'recent', at: NOW - 3600_000, payload: 'y' },
    ]);
    expect(await service().tick()).toBe(1);
    expect(sent.map((s) => JSON.parse(s.body).key)).toEqual(['recent']);
  });

  it('start/stop run the timer without blocking shutdown', async () => {
    await schedule([{ key: 'k', at: Date.now() - 1, payload: 'x' }]);
    vi.useFakeTimers();
    try {
      const svc = createPushService({ store, sender, intervalMs: 1000 });
      svc.start();
      svc.start(); // idempotent
      await vi.advanceTimersByTimeAsync(1100);
      svc.stop();
      expect(sent).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('VAPID keys', () => {
  it('are P-256 keys in base64url', () => {
    const keys = generateVapidKeys();
    expect(Buffer.from(keys.publicKey, 'base64url')).toHaveLength(65);
    expect(Buffer.from(keys.publicKey, 'base64url')[0]).toBe(4); // uncompressed point
    expect(Buffer.from(keys.privateKey, 'base64url')).toHaveLength(32);
  });

  it('come from the environment when given, else persist in the database', () => {
    const mem = openStore(':memory:');
    const generated = ensureVapidKeys(mem);
    expect(ensureVapidKeys(mem)).toEqual(generated);
    expect(ensureVapidKeys(mem, { publicKey: 'P', privateKey: 'S' })).toEqual({
      publicKey: 'P',
      privateKey: 'S',
    });
    expect(mem.vapid()).toEqual(generated); // the environment does not overwrite the stored pair
    mem.close();
  });
});

describe('VAPID private key length', () => {
  it('pads a scalar with leading zero bytes to 32 bytes', () => {
    const short = Buffer.from([1, 2, 3]);
    expect(padPrivateKey(short)).toHaveLength(32);
    expect(padPrivateKey(short).subarray(29)).toEqual(short);
    expect(padPrivateKey(Buffer.alloc(32, 7))).toHaveLength(32);
  });
  it('every generated key decodes to 32 bytes', () => {
    for (let i = 0; i < 600; i++)
      expect(Buffer.from(generateVapidKeys().privateKey, 'base64url')).toHaveLength(32);
  });
});

describe('web-push request', () => {
  it('is encrypted for the subscription and signed with VAPID', () => {
    const browser = createECDH('prime256v1');
    browser.generateKeys();
    const details = webpush.generateRequestDetails(
      {
        endpoint: 'https://push.example.test/send/1',
        keys: {
          p256dh: browser.getPublicKey().toString('base64url'),
          auth: randomBytes(16).toString('base64url'),
        },
      },
      JSON.stringify({ v: 1, key: 'k', payload: 'hello' }),
      requestOptions(generateVapidKeys(), 'mailto:test@example.com'),
    ) as { method: string; headers: Record<string, string>; body: Buffer; endpoint: string };
    expect(details.method).toBe('POST');
    expect(details.headers['Content-Encoding']).toBe('aes128gcm');
    expect(details.headers.Authorization).toMatch(/^vapid t=.+, k=.+/);
    expect(Number(details.headers.TTL)).toBe(3600);
    expect(details.body.includes(Buffer.from('hello'))).toBe(false); // ciphertext, not plaintext
  });
});
