import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auth, hlc, op, pull, push, setup, TOKEN } from './helpers.js';
import type { Store } from '../src/store.js';

let app: FastifyInstance;
let store: Store;

beforeEach(async () => ({ app, store } = await setup()));
afterEach(async () => {
  await app.close();
  store.close();
});

describe('authentication', () => {
  it('health is public, everything else needs the bearer token', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/health' })).json()).toEqual({ ok: true });
    for (const [method, url] of [
      ['GET', '/v1/pull'],
      ['POST', '/v1/push'],
      ['GET', '/v1/vault'],
      ['PUT', '/v1/vault'],
      ['POST', '/v1/reset'],
    ] as const) {
      const res = await app.inject({ method, url, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('rejects wrong, malformed and empty tokens', async () => {
    for (const authorization of ['Bearer nope', `Basic ${TOKEN}`, TOKEN, 'Bearer ', 'Bearer  ']) {
      const res = await app.inject({ method: 'GET', url: '/v1/pull', headers: { authorization } });
      expect(res.statusCode, authorization).toBe(401);
    }
  });

  it('accepts any of several configured tokens', async () => {
    const second = await setup({ tokens: ['first-token-0123456789', 'second-token-0123456789'] });
    const res = await second.app.inject({
      method: 'GET',
      url: '/v1/pull',
      headers: { authorization: 'Bearer second-token-0123456789' },
    });
    expect(res.statusCode).toBe(200);
    await second.app.close();
    second.store.close();
  });

  it('never caches API responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/pull', headers: auth });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('push and pull', () => {
  it('stores ops and returns them in arrival order with a cursor', async () => {
    const r = await push(app, [op('title', hlc(1000), 'A'), op('done', hlc(1000), false)]);
    expect(r.body).toMatchObject({ accepted: 2, cursor: 2 });
    const p = await pull(app);
    expect(p.body.ops.map((o) => o.field)).toEqual(['title', 'done']);
    expect(p.body.cursor).toBe(2);
    expect(p.body.more).toBe(false);
    expect(p.body.epoch).toBe(store.epoch());
  });

  it('only accepts ops with a greater HLC and does not advance the cursor for rejected ones', async () => {
    await push(app, [op('title', hlc(2000), 'new')]);
    const stale = await push(app, [op('title', hlc(1000), 'old')]);
    expect(stale.body).toMatchObject({ accepted: 0, cursor: 1 });
    const same = await push(app, [op('title', hlc(2000), 'new')]);
    expect(same.body.accepted).toBe(0);
    expect((await pull(app)).body.ops).toEqual([op('title', hlc(2000), 'new')]);
  });

  it('a superseded field moves to the end of the change stream (new seq)', async () => {
    await push(app, [op('a', hlc(1000), 1), op('b', hlc(1000), 2)]);
    await push(app, [op('a', hlc(2000), 3)]);
    const p = await pull(app);
    expect(p.body.ops.map((o) => o.field)).toEqual(['b', 'a']);
    const incremental = await pull(app, 2);
    expect(incremental.body.ops).toEqual([op('a', hlc(2000), 3)]);
  });

  it('pages through large change sets', async () => {
    const ops = Array.from({ length: 25 }, (_, i) => op('title', hlc(1000 + i), `v${i}`, `r${i}`));
    await push(app, ops);
    const first = await pull(app, 0, 10);
    expect(first.body.ops).toHaveLength(10);
    expect(first.body.more).toBe(true);
    const second = await pull(app, first.body.cursor, 10);
    const third = await pull(app, second.body.cursor, 10);
    expect(third.body.ops).toHaveLength(5);
    expect(third.body.more).toBe(false);
    expect(
      new Set([...first.body.ops, ...second.body.ops, ...third.body.ops].map((o) => o.id)).size,
    ).toBe(25);
    // Nothing new: the cursor stays where it is.
    expect((await pull(app, third.body.cursor)).body).toMatchObject({
      ops: [],
      cursor: third.body.cursor,
      more: false,
    });
  });

  it('keeps arbitrary JSON values incl. null, arrays, objects and unicode', async () => {
    const values = [null, 0, false, '', 'Übung 🎉', [1, [2]], { a: { b: null } }];
    await push(
      app,
      values.map((v, i) => op(`f${i}`, hlc(1000), v)),
    );
    expect((await pull(app)).body.ops.map((o) => o.value)).toEqual(values);
  });

  it('rejects malformed ops', async () => {
    const bad = [
      { ...op('title', hlc(1), 'x'), hlc: 'nope' },
      { ...op('title', hlc(1), 'x'), collection: 'bad collection' },
      { ...op('title', hlc(1), 'x'), id: '' },
      { ...op('title', hlc(1), 'x'), extra: 1 },
      { collection: 'a', id: 'b', field: 'c', hlc: hlc(1) },
    ];
    for (const o of bad) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/push',
        headers: auth,
        payload: { ops: [o] },
      });
      expect(res.statusCode).toBe(400);
    }
    const res = await app.inject({
      method: 'POST',
      url: '/v1/push',
      headers: auth,
      payload: { nope: [] },
    });
    expect(res.statusCode).toBe(400);
    expect((await pull(app)).body.ops).toEqual([]);
  });

  it('rejects oversized batches and values', async () => {
    const many = Array.from({ length: 5001 }, (_, i) => op('f', hlc(1), 1, `r${i}`));
    expect(
      (await app.inject({ method: 'POST', url: '/v1/push', headers: auth, payload: { ops: many } }))
        .statusCode,
    ).toBe(400);
    const huge = op('blob', hlc(1), 'x'.repeat(1_100_000));
    expect((await push(app, [huge])).status).toBe(413);
  });

  it('validates pull parameters', async () => {
    for (const q of ['since=-1', 'limit=0', 'limit=99999', 'since=abc']) {
      expect(
        (await app.inject({ method: 'GET', url: `/v1/pull?${q}`, headers: auth })).statusCode,
        q,
      ).toBe(400);
    }
  });
});

describe('vault (end-to-end encryption metadata)', () => {
  const vault = { salt: 'c2FsdHNhbHRzYWx0', check: 'enc:v1:abcdefgh:ijklmnop' };

  it('is empty at first, the first writer wins, later attempts get 409 with the existing vault', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/v1/vault', headers: auth })).json(),
    ).toMatchObject({ vault: null });
    const created = await app.inject({
      method: 'PUT',
      url: '/v1/vault',
      headers: auth,
      payload: vault,
    });
    expect(created.statusCode).toBe(201);
    const again = await app.inject({
      method: 'PUT',
      url: '/v1/vault',
      headers: auth,
      payload: { salt: 'ZGlmZmVyZW50', check: 'other-check' },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ vault });
    expect(
      (await app.inject({ method: 'GET', url: '/v1/vault', headers: auth })).json(),
    ).toMatchObject({ vault });
  });

  it('validates the body', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/vault',
      headers: auth,
      payload: { salt: 'x' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('reset', () => {
  it('needs the explicit confirmation, wipes data and vault and starts a new epoch', async () => {
    await push(app, [op('title', hlc(1000), 'x')]);
    await app.inject({
      method: 'PUT',
      url: '/v1/vault',
      headers: auth,
      payload: { salt: 'c2FsdHNhbHRz', check: 'checkcheck' },
    });
    const epoch = store.epoch();

    expect(
      (await app.inject({ method: 'POST', url: '/v1/reset', headers: auth, payload: {} }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/reset',
          headers: auth,
          payload: { confirm: 'yes' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await pull(app)).body.ops).toHaveLength(1);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/reset',
      headers: auth,
      payload: { confirm: 'RESET' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().epoch).not.toBe(epoch);
    const p = await pull(app);
    expect(p.body).toMatchObject({ ops: [], cursor: 0, epoch: res.json().epoch });
    expect(store.vault()).toBeNull();
    // Sequence numbers start over.
    expect((await push(app, [op('title', hlc(1), 'again')])).body.cursor).toBe(1);
  });
});

describe('CORS', () => {
  it('answers preflight requests for the API', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/push',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeDefined();
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain(
      'authorization',
    );
  });

  it('can be restricted to an allow-list of origins', async () => {
    const restricted = await setup({ corsOrigins: ['https://taschenmesser.example'] });
    const allowed = await restricted.app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { origin: 'https://taschenmesser.example' },
    });
    const denied = await restricted.app.inject({
      method: 'GET',
      url: '/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://taschenmesser.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    await restricted.app.close();
    restricted.store.close();
  });
});

describe('rate limit', () => {
  it('answers 429 after too many requests', async () => {
    const limited = await setup({ rateLimit: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      codes.push((await limited.app.inject({ method: 'GET', url: '/v1/health' })).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    await limited.app.close();
    limited.store.close();
  });
});
