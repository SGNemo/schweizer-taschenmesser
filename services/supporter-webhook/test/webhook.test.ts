import { describe, expect, it } from 'vitest';
import { verifyCode } from '../../../packages/supporter-codes/src/index.ts';
import { handleFetch } from '../src/index.ts';
import { donation, kofiRequest, makeDeps, makeEnv, PUBLIC_KEYS } from './helpers.ts';

const call = (env: ReturnType<typeof makeEnv>['env'], req: Request) =>
  handleFetch(req, env, makeDeps().deps);

describe('Ko-fi webhook', () => {
  it('a valid donation issues one signed code and queues the mail', async () => {
    const { env, kv, jobs } = makeEnv();
    const res = await call(env, kofiRequest(donation()));
    expect(res.status).toBe(200);
    expect(jobs).toHaveLength(1);
    const job = jobs[0]!;
    expect(job.to).toBe('ada.donor@example.invalid');
    expect(job.kind).toBe('code');
    expect(verifyCode(job.code, PUBLIC_KEYS)).toMatchObject({
      ok: true,
      tier: 'kaffee',
      name: 'Ada Beispiel',
      issued: '2026-10-05',
    });
    expect(kv.data.get('stats:issued')).toBe('1');
  });

  it('stores no plain address, name or code-bearing amount in KV – only hashes and the code', async () => {
    const { env, kv } = makeEnv();
    await call(env, kofiRequest(donation()));
    const dump = kv.dump();
    expect(dump).not.toContain('ada.donor');
    expect(dump).not.toContain('example.invalid');
    expect(dump).not.toContain('11111111-2222'); // the transaction id itself
    expect(dump).not.toContain('Ada Beispiel');
  });

  it('a wrong verification token gets 401 and nothing happens', async () => {
    const { env, kv, jobs } = makeEnv();
    const res = await call(env, kofiRequest(donation({ verification_token: 'wrong' })));
    expect(res.status).toBe(401);
    expect(kv.writes).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it('unsigned or malformed calls are refused with 401 and nothing happens', async () => {
    const { env, kv, jobs } = makeEnv();
    for (const body of ['', 'data=', 'data=not-json', 'x=1', 'data=%7B%7D', 'data=%5B%5D']) {
      const res = await call(
        env,
        new Request('https://hook.example.invalid/kofi', { method: 'POST', body }),
      );
      expect(res.status, body).toBe(401);
    }
    const noToken = { ...donation() } as Record<string, unknown>;
    delete noToken.verification_token;
    expect((await call(env, kofiRequest(noToken))).status).toBe(401);
    expect(kv.writes).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it('a duplicate webhook sends the same code again and issues no new one', async () => {
    const { env, kv, jobs } = makeEnv();
    await call(env, kofiRequest(donation()));
    const writesAfterFirst = kv.writes.length;
    const again = await call(env, kofiRequest(donation({ message_id: 'another-delivery' })));
    expect(again.status).toBe(200);
    expect(jobs).toHaveLength(2);
    expect(jobs[1]!.code).toBe(jobs[0]!.code);
    expect(kv.writes).toHaveLength(writesAfterFirst); // no new records, counter unchanged
    expect(kv.data.get('stats:issued')).toBe('1');
  });

  it('another transaction gets another code', async () => {
    const { env, jobs } = makeEnv();
    await call(env, kofiRequest(donation()));
    await call(env, kofiRequest(donation({ kofi_transaction_id: 'other-transaction' })));
    expect(jobs[1]!.code).not.toBe(jobs[0]!.code);
  });

  it('other event types are acknowledged and ignored', async () => {
    const { env, kv, jobs } = makeEnv();
    for (const p of [
      donation({ type: 'Shop Order' }),
      donation({ type: 'Commission' }),
      donation({ type: 'Subscription', is_first_subscription_payment: false }),
    ]) {
      const res = await call(env, kofiRequest(p));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ignored: true });
    }
    expect(kv.writes).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it('the first payment of a membership earns a code', async () => {
    const { env, jobs } = makeEnv();
    await call(
      env,
      kofiRequest(donation({ type: 'Subscription', is_first_subscription_payment: true })),
    );
    expect(jobs).toHaveLength(1);
  });

  it('a name only comes from a public donation', async () => {
    const { env, jobs } = makeEnv();
    await call(env, kofiRequest(donation({ is_public: false })));
    expect(verifyCode(jobs[0]!.code, PUBLIC_KEYS)).toMatchObject({ ok: true, name: '' });
  });

  it('derives the tier from amount and currency; a zero or broken amount earns nothing', async () => {
    const { env, jobs } = makeEnv();
    const run = async (n: number, amount: string, currency = 'EUR') => {
      await call(env, kofiRequest(donation({ kofi_transaction_id: `tx-${n}`, amount, currency })));
    };
    await run(1, '5.00');
    await run(2, '10.00');
    await run(3, '3.00', 'USD');
    await run(4, '9,99');
    await run(5, '0.00');
    await run(6, 'abc');
    const tiers = jobs.map((j) => (verifyCode(j.code, PUBLIC_KEYS) as { tier: string }).tier);
    expect(tiers).toEqual(['kaffee', 'kuchen', 'kaffee', 'kaffee']);
  });

  it('refuses everything but POST on the webhook path and nothing but GET on /health', async () => {
    const { env } = makeEnv();
    for (const method of ['GET', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD']) {
      const res = await call(env, new Request('https://h.example.invalid/kofi', { method }));
      expect(res.status, method).toBe(405);
    }
    expect((await call(env, new Request('https://h.example.invalid/kofi'))).status).toBe(405);
    expect((await call(env, new Request('https://h.example.invalid/nope'))).status).toBe(404);
    expect(
      (await call(env, new Request('https://h.example.invalid/health', { method: 'POST' }))).status,
    ).toBe(405);
  });

  it('health says ok and nothing else; no response carries CORS headers', async () => {
    const { env } = makeEnv();
    const health = await call(env, new Request('https://h.example.invalid/health'));
    expect(await health.json()).toEqual({ ok: true });
    const responses = [
      health,
      await call(env, kofiRequest(donation())),
      await call(env, kofiRequest(donation({ verification_token: 'x' }))),
      await call(env, new Request('https://h.example.invalid/kofi', { method: 'OPTIONS' })),
      await call(env, new Request('https://h.example.invalid/resend')),
    ];
    for (const r of responses) {
      for (const [name] of r.headers) expect(name.toLowerCase()).not.toMatch(/^access-control-/);
    }
  });

  it('rejects an oversized body (declared or streamed) without reading further', async () => {
    const { env, kv, jobs } = makeEnv();
    const big = 'a'.repeat(20_000);
    const declared = new Request('https://h.example.invalid/kofi', {
      method: 'POST',
      headers: { 'content-length': '20000' },
      body: `data=${big}`,
    });
    expect((await call(env, declared)).status).toBe(413);
    const streamed = new Request('https://h.example.invalid/kofi', {
      method: 'POST',
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(big));
          c.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);
    expect((await call(env, streamed)).status).toBe(413);
    expect(kv.writes).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it('answers 429 when the rate limit is hit, before doing any work', async () => {
    const { env, kv, jobs } = makeEnv({
      RATE_LIMITER: { limit: async () => ({ success: false }) },
    });
    const res = await call(env, kofiRequest(donation()));
    expect(res.status).toBe(429);
    expect(kv.writes).toEqual([]);
    expect(jobs).toEqual([]);
  });

  it('a missing secret is a 500 (noticed), never a silent success', async () => {
    const { env, jobs } = makeEnv({ HASH_PEPPER: '' });
    expect((await call(env, kofiRequest(donation()))).status).toBe(500);
    const broken = makeEnv({ SUPPORTER_SIGNING_KEY: 'not-hex' });
    expect((await call(broken.env, kofiRequest(donation()))).status).toBe(500);
    expect(jobs).toEqual([]);
  });

  it('a failing queue answers 500 so Ko-fi retries, and the retry is a duplicate not a new code', async () => {
    const { env, kv } = makeEnv();
    let fail = true;
    const sent: string[] = [];
    env.MAIL_QUEUE = {
      send: async (m) => {
        if (fail) throw new Error('queue down');
        sent.push(m.code);
      },
    };
    await expect(call(env, kofiRequest(donation()))).rejects.toThrow('queue down');
    fail = false;
    const retry = await call(env, kofiRequest(donation()));
    expect(retry.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(kv.data.get('stats:issued')).toBe('1');
  });
});
