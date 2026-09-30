import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { redactUrl } from '../src/app.js';
import type { Store } from '../src/store.js';
import { auth, hlc, op, setup, TOKEN } from './helpers.js';

let app: FastifyInstance;
let store: Store;
let clock = 1_800_000_000_000;

async function boot(overrides: Parameters<typeof setup>[0] = {}) {
  clock = 1_800_000_000_000;
  ({ app, store } = await setup({ clock: () => clock, ...overrides }));
}
afterEach(async () => {
  await app.close();
  store.close();
});

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function register(id = 'phone01', name = 'Handy'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/devices',
    headers: auth,
    payload: { id, name },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { token: string }).token;
}

describe('devices', () => {
  it('registers a device that works with its own token; only a hash is stored', async () => {
    await boot();
    const token = await register();
    expect(token.length).toBeGreaterThanOrEqual(40);

    const pull = await app.inject({ method: 'GET', url: '/v1/pull', headers: bearer(token) });
    expect(pull.statusCode).toBe(200);
    const info = (
      await app.inject({ method: 'GET', url: '/v1/info', headers: bearer(token) })
    ).json();
    expect(info).toMatchObject({ protocol: 2, role: 'device', deviceId: 'phone01' });
    expect(info.features).toContain('devices');
    expect(
      (await app.inject({ method: 'GET', url: '/v1/info', headers: auth })).json(),
    ).toMatchObject({
      role: 'admin',
      deviceId: null,
    });

    expect(JSON.stringify(store.listDevices())).not.toContain(token);
    expect(store.deviceByTokenHash(token)).toBeUndefined(); // the raw token is not the key
  });

  it('tracks last seen / push / pull and lists devices with the current one marked', async () => {
    await boot();
    const token = await register();
    clock += 120_000;
    await app.inject({
      method: 'POST',
      url: '/v1/push',
      headers: bearer(token),
      payload: { ops: [op('title', hlc(1000), 'x')] },
    });
    clock += 1000;
    await app.inject({ method: 'GET', url: '/v1/pull', headers: bearer(token) });

    const list = (
      await app.inject({ method: 'GET', url: '/v1/devices', headers: bearer(token) })
    ).json() as { devices: Record<string, unknown>[] };
    expect(list.devices).toHaveLength(1);
    expect(list.devices[0]).toMatchObject({
      id: 'phone01',
      name: 'Handy',
      current: true,
      revokedAt: null,
      lastPushAt: clock - 1000,
      lastPullAt: clock,
    });
    expect(list.devices[0]).not.toHaveProperty('tokenHash');
    expect(list.devices[0]).not.toHaveProperty('token_hash');
  });

  it('rejects duplicates and bad input', async () => {
    await boot();
    await register();
    const dup = await app.inject({
      method: 'POST',
      url: '/v1/devices',
      headers: auth,
      payload: { id: 'phone01', name: 'Nochmal' },
    });
    expect(dup.statusCode).toBe(409);
    for (const payload of [
      { id: 'Bad Id', name: 'x' },
      { id: 'ok01', name: '' },
      { id: 'ok01', name: 'x'.repeat(65) },
      { id: 'ok01', name: 'x', extra: 1 },
    ]) {
      const res = await app.inject({ method: 'POST', url: '/v1/devices', headers: auth, payload });
      expect(res.statusCode, JSON.stringify(payload)).toBe(400);
    }
  });

  it('a device token can neither register devices nor reset the server', async () => {
    await boot();
    const token = await register();
    const create = await app.inject({
      method: 'POST',
      url: '/v1/devices',
      headers: bearer(token),
      payload: { id: 'other01', name: 'x' },
    });
    expect(create.statusCode).toBe(403);
    const reset = await app.inject({
      method: 'POST',
      url: '/v1/reset',
      headers: bearer(token),
      payload: { confirm: 'RESET' },
    });
    expect(reset.statusCode).toBe(403);
    // the shared token still may
    const ok = await app.inject({
      method: 'POST',
      url: '/v1/reset',
      headers: auth,
      payload: { confirm: 'RESET' },
    });
    expect(ok.statusCode).toBe(200);
  });

  it('locks a device out immediately, also from another device; data stays', async () => {
    await boot();
    const phone = await register('phone01', 'Handy');
    const laptop = await register('laptop01', 'Laptop');
    await app.inject({
      method: 'POST',
      url: '/v1/push',
      headers: bearer(phone),
      payload: { ops: [op('title', hlc(1000), 'x')] },
    });

    const revoke = await app.inject({
      method: 'DELETE',
      url: '/v1/devices/phone01',
      headers: bearer(laptop),
    });
    expect(revoke.statusCode).toBe(200);

    const denied = await app.inject({ method: 'GET', url: '/v1/pull', headers: bearer(phone) });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toEqual({ error: 'revoked' });
    expect(
      (await app.inject({ method: 'GET', url: '/v1/pull', headers: bearer(laptop) })).json().ops,
    ).toHaveLength(1);

    const list = (
      await app.inject({ method: 'GET', url: '/v1/devices', headers: auth })
    ).json() as { devices: { id: string; revokedAt: number | null }[] };
    expect(list.devices.find((d) => d.id === 'phone01')!.revokedAt).toBe(clock);
    // revoked devices cannot come back through rotation
    const rotate = await app.inject({
      method: 'POST',
      url: '/v1/devices/phone01/rotate',
      headers: auth,
    });
    expect(rotate.statusCode).toBe(404);
    expect(
      (await app.inject({ method: 'DELETE', url: '/v1/devices/nobody', headers: auth })).statusCode,
    ).toBe(404);
  });

  it('rotates a token: the old one stops working, only admin or the device itself may rotate', async () => {
    await boot();
    const old = await register();
    await register('laptop01', 'Laptop');
    const rotated = await app.inject({
      method: 'POST',
      url: '/v1/devices/phone01/rotate',
      headers: bearer(old),
    });
    expect(rotated.statusCode).toBe(200);
    const fresh = (rotated.json() as { token: string }).token;
    expect(fresh).not.toBe(old);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/pull', headers: bearer(old) })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/v1/pull', headers: bearer(fresh) })).statusCode,
    ).toBe(200);
    const foreign = await app.inject({
      method: 'POST',
      url: '/v1/devices/laptop01/rotate',
      headers: bearer(fresh),
    });
    expect(foreign.statusCode).toBe(403);
  });

  it('every device route needs a valid token', async () => {
    await boot();
    for (const [method, url] of [
      ['GET', '/v1/devices'],
      ['POST', '/v1/devices'],
      ['DELETE', '/v1/devices/phone01'],
      ['POST', '/v1/devices/phone01/rotate'],
      ['GET', '/v1/info'],
      ['GET', '/v1/status'],
    ] as const) {
      const res = await app.inject({ method, url, payload: method === 'POST' ? {} : undefined });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe('failed-login limiter', () => {
  it('blocks an address after too many failures, even for a valid token, and recovers', async () => {
    await boot({ authFailureLimit: 3 });
    const bad = () =>
      app.inject({ method: 'GET', url: '/v1/pull', headers: bearer('wrong-token-xxxxxxxxxxxx') });
    expect([(await bad()).statusCode, (await bad()).statusCode, (await bad()).statusCode]).toEqual([
      401, 401, 401,
    ]);
    const blocked = await bad();
    expect(blocked.statusCode).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await app.inject({ method: 'GET', url: '/v1/pull', headers: auth })).statusCode).toBe(
      429,
    );

    clock += 61_000;
    expect((await app.inject({ method: 'GET', url: '/v1/pull', headers: auth })).statusCode).toBe(
      200,
    );
  });

  it('successful requests never count as failures', async () => {
    await boot({ authFailureLimit: 2 });
    for (let i = 0; i < 6; i++)
      expect((await app.inject({ method: 'GET', url: '/v1/pull', headers: auth })).statusCode).toBe(
        200,
      );
  });

  it('counts real client addresses only behind a trusted proxy', async () => {
    const attempt = (forwarded: string) =>
      app.inject({
        method: 'GET',
        url: '/v1/pull',
        headers: { ...bearer('wrong-token-xxxxxxxxxxxx'), 'x-forwarded-for': forwarded },
        remoteAddress: '10.0.0.1',
      });

    await boot({ authFailureLimit: 1, trustProxy: true });
    expect((await attempt('203.0.113.1')).statusCode).toBe(401);
    expect((await attempt('203.0.113.2')).statusCode).toBe(401); // a different client, not blocked
    expect((await attempt('203.0.113.1')).statusCode).toBe(429);
    await app.close();
    store.close();

    await boot({ authFailureLimit: 1, trustProxy: false });
    expect((await attempt('203.0.113.1')).statusCode).toBe(401);
    expect((await attempt('203.0.113.2')).statusCode).toBe(429); // header ignored: same peer
  });
});

describe('vault v2, status, logging', () => {
  it('stores Argon2id parameters and rejects inconsistent vaults', async () => {
    await boot();
    const kdf = { alg: 'argon2id', m: 65536, t: 3, p: 1 };
    const put = (payload: unknown) =>
      app.inject({ method: 'PUT', url: '/v1/vault', headers: auth, payload });
    expect((await put({ salt: 'c2FsdHNhbHRz', check: 'checkcheck', v: 2 })).statusCode).toBe(400);
    expect((await put({ salt: 'c2FsdHNhbHRz', check: 'checkcheck', kdf })).statusCode).toBe(400);
    expect(
      (await put({ salt: 'c2FsdHNhbHRz', check: 'checkcheck', v: 2, kdf: { ...kdf, m: 1 } }))
        .statusCode,
    ).toBe(400);
    expect((await put({ salt: 'c2FsdHNhbHRz', check: 'checkcheck', v: 2, kdf })).statusCode).toBe(
      201,
    );

    const got = (await app.inject({ method: 'GET', url: '/v1/vault', headers: auth })).json();
    expect(got.vault).toEqual({ salt: 'c2FsdHNhbHRz', check: 'checkcheck', v: 2, kdf });
    // reset wipes the vault including its parameters
    await app.inject({
      method: 'POST',
      url: '/v1/reset',
      headers: auth,
      payload: { confirm: 'RESET' },
    });
    expect(
      (await app.inject({ method: 'GET', url: '/v1/vault', headers: auth })).json().vault,
    ).toBeNull();
  });

  it('reports size and record counts without reading values', async () => {
    await boot();
    await app.inject({
      method: 'POST',
      url: '/v1/push',
      headers: auth,
      payload: {
        ops: [
          op('a', hlc(1), 'xxxx', 'r1'),
          op('b', hlc(1), 'yy', 'r1'),
          op('a', hlc(1), 'z', 'r2'),
        ],
      },
    });
    const status = (await app.inject({ method: 'GET', url: '/v1/status', headers: auth })).json();
    expect(status).toMatchObject({ fields: 3, records: 2, devices: 0 });
    expect(status.bytes).toBeGreaterThan(0);
  });

  it('keeps feed URLs out of the log', () => {
    expect(redactUrl('/v1/proxy?url=https%3A%2F%2Fexample.org%2Fcal.ics%3Ftoken%3DSECRET')).toBe(
      '/v1/proxy?url=[redacted]',
    );
    expect(redactUrl('/v1/pull?since=5')).toBe('/v1/pull?since=5');
  });

  it('never puts the token into responses', async () => {
    await boot();
    const res = await app.inject({ method: 'GET', url: '/v1/devices', headers: auth });
    expect(res.body).not.toContain(TOKEN);
  });
});
