import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { clearCooldown, coolingDown, cooldownFor, createRouter, type RouterMember } from './router';
import {
  AiError,
  type AiErrorCode,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
} from './providers/types';
import { recordUsage, startOfDay, startOfMonth } from './usage';

const REQ: CompletionRequest = { system: 's', user: 'u', tools: [] };
const ok = (model = 'm', usage = { inputTokens: 1000, outputTokens: 100 }): CompletionResult => ({
  toolCalls: [{ name: 'run_query', input: {} }],
  text: '',
  usage,
  model,
});

type Step = CompletionResult | AiError;
function fake(id: string, steps: Step[]): AiProvider & { complete: ReturnType<typeof vi.fn> } {
  const queue = [...steps];
  return {
    id,
    model: `${id}-model`,
    complete: vi.fn(async () => {
      const next = queue.shift() ?? queue[0] ?? ok();
      if (next instanceof Error) throw next;
      return next;
    }),
  };
}
const member = (
  provider: AiProvider,
  extra: Partial<RouterMember['entry']> = {},
): RouterMember => ({
  entry: { id: provider.id, label: provider.id, limits: {}, price: undefined, ...extra },
  provider,
});
const err = (code: AiErrorCode, extra: { retryAfterMs?: number } = {}) =>
  new AiError(code, code, extra);

let clock = Date.UTC(2026, 8, 29, 12, 0, 0);
const now = () => clock;

beforeEach(async () => {
  clearCooldown();
  clock = new Date(2026, 8, 29, 12, 0, 0).getTime();
  await db.table('_aiUsage').clear();
});

const route = (members: RouterMember[]) => createRouter({ members, now });
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof AiError ? e.code : String(e);
  }
};

describe('router: fallback chain', () => {
  it('uses the first provider and reports who answered', async () => {
    const a = fake('a', [ok('a-model')]);
    const b = fake('b', [ok()]);
    const res = await route([member(a), member(b)]).complete(REQ);
    expect(res).toMatchObject({ providerId: 'a', model: 'a-model', attempts: [] });
    expect(b.complete).not.toHaveBeenCalled();
  });

  it.each([
    'rate-limit',
    'server',
    'network',
    'unavailable',
    'auth',
    'bad-request',
    'refusal',
    'invalid-response',
  ] as const)(
    'falls back to the next provider on %s and reports the failed attempt',
    async (code) => {
      const a = fake('a', [err(code)]);
      const b = fake('b', [ok('b-model')]);
      const res = await route([member(a), member(b)]).complete(REQ);
      expect(res).toMatchObject({ providerId: 'b', model: 'b-model' });
      expect(res.attempts).toEqual([
        { providerId: 'a', model: 'a-model', error: code, detail: code },
      ]);
    },
  );

  it('walks the whole list in order', async () => {
    const a = fake('a', [err('rate-limit')]);
    const b = fake('b', [err('server')]);
    const c = fake('c', [ok()]);
    const res = await route([member(a), member(b), member(c)]).complete(REQ);
    expect(res.providerId).toBe('c');
    expect(res.attempts?.map((x) => x.providerId)).toEqual(['a', 'b']);
  });

  it('does not fall back when the user aborts', async () => {
    const a = fake('a', [err('aborted')]);
    const b = fake('b', [ok()]);
    expect(await codeOf(route([member(a), member(b)]).complete(REQ))).toBe('aborted');
    expect(b.complete).not.toHaveBeenCalled();
  });

  it('treats an answer that fails the plausibility check as unusable and tries the next provider', async () => {
    const a = fake('a', [ok('bad')]);
    const b = fake('b', [ok('good')]);
    const check = vi.fn((r: CompletionResult) => {
      if (r.model === 'bad') throw new Error('not a valid intent');
    });
    const res = await route([member(a), member(b)]).complete({ ...REQ, check });
    expect(res).toMatchObject({ providerId: 'b', model: 'good' });
    expect(res.attempts).toEqual([
      {
        providerId: 'a',
        model: 'a-model',
        error: 'invalid-response',
        detail: 'not a valid intent',
      },
    ]);
  });

  it('reports the original error when the only provider fails, "exhausted" when several did', async () => {
    const single = route([member(fake('a', [err('auth')]))]);
    await expect(single.complete(REQ)).rejects.toMatchObject({
      code: 'auth',
      attempts: [{ providerId: 'a', error: 'auth' }],
    });
    clearCooldown();
    const many = route([member(fake('a', [err('auth')])), member(fake('b', [err('server')]))]);
    await expect(many.complete(REQ)).rejects.toMatchObject({
      code: 'exhausted',
      attempts: [{ providerId: 'a' }, { providerId: 'b' }],
    });
  });

  it('is "not-configured" without providers', async () => {
    expect(await codeOf(route([]).complete(REQ))).toBe('not-configured');
  });
});

describe('router: cooldowns', () => {
  it('pauses a provider for the Retry-After time and skips it meanwhile', async () => {
    const a = fake('a', [err('rate-limit', { retryAfterMs: 120_000 }), ok()]);
    const b = fake('b', [ok()]);
    const r = route([member(a), member(b)]);
    await r.complete(REQ); // a fails → b answers
    expect(coolingDown('a', clock)).toBeDefined();

    clock += 119_000;
    expect((await r.complete(REQ)).providerId).toBe('b');
    expect(a.complete).toHaveBeenCalledTimes(1); // not even tried

    clock += 2_000;
    expect((await r.complete(REQ)).providerId).toBe('a'); // pause is over
    expect(coolingDown('a', clock)).toBeUndefined();
  });

  it('uses sensible pauses per error and caps Retry-After at an hour', () => {
    const minute = 60_000;
    expect(cooldownFor(err('rate-limit'))).toBe(minute);
    expect(cooldownFor(err('rate-limit', { retryAfterMs: 5 * 3_600_000 }))).toBe(60 * minute);
    expect(cooldownFor(err('auth'))).toBe(30 * minute);
    expect(cooldownFor(err('bad-request'))).toBe(5 * minute);
    expect(cooldownFor(err('server'))).toBe(minute / 2);
    expect(cooldownFor(err('refusal'))).toBe(0);
    expect(cooldownFor(err('aborted'))).toBe(0);
  });

  it('a rejected key keeps a provider out for 30 minutes; clearing the pause brings it back', async () => {
    const a = fake('a', [err('auth'), ok()]);
    const b = fake('b', [ok()]);
    const r = route([member(a), member(b)]);
    await r.complete(REQ);
    clock += 29 * 60_000;
    await r.complete(REQ);
    expect(a.complete).toHaveBeenCalledTimes(1);
    clearCooldown('a'); // e.g. the user saved a new key
    expect((await r.complete(REQ)).providerId).toBe('a');
  });

  it('reports "exhausted" when every provider is paused', async () => {
    const a = fake('a', [err('rate-limit', { retryAfterMs: 60_000 })]);
    const r = route([member(a)]);
    await codeOf(r.complete(REQ));
    expect(await codeOf(r.complete(REQ))).toBe('exhausted');
  });
});

describe('router: local limits', () => {
  const row = (provider: string, at: number, extra: Record<string, unknown> = {}) =>
    recordUsage(
      { provider, model: 'm', inputTokens: 100, outputTokens: 10, cacheHit: false, ...extra },
      db,
    ).then(async () => {
      // recordUsage stamps "now"; move the row to the wanted time
      const rows = await db.table('_aiUsage').toArray();
      const last = rows[rows.length - 1];
      await db.table('_aiUsage').update(last.id, { at });
    });

  it('skips a provider whose daily request limit is used up – but only for today', async () => {
    const a = fake('a', [ok()]);
    const b = fake('b', [ok()]);
    const limited = member(a, { limits: { requestsPerDay: 2 } });
    await row('a', startOfDay(clock) + 1000);
    await row('a', startOfDay(clock) + 2000);
    await row('a', startOfDay(clock) - 1000); // yesterday: does not count
    const r = route([limited, member(b)]);
    expect((await r.complete(REQ)).providerId).toBe('b');
    expect(a.complete).not.toHaveBeenCalled();

    clock += 24 * 3_600_000; // tomorrow: fresh quota
    expect((await r.complete(REQ)).providerId).toBe('a');
  });

  it('counts failed calls against the request limit, but not cache hits', async () => {
    const a = fake('a', [ok()]);
    const b = fake('b', [ok()]);
    await row('a', startOfDay(clock) + 1, { outcome: 'error', errorCode: 'server' });
    await row('a', startOfDay(clock) + 2, { cacheHit: true });
    const r = route([member(a, { limits: { requestsPerDay: 2 } }), member(b)]);
    expect((await r.complete(REQ)).providerId).toBe('a'); // 1 of 2 used
  });

  it('skips a provider whose monthly cost limit is reached', async () => {
    const a = fake('a', [ok()]);
    const b = fake('b', [ok()]);
    await row('a', startOfMonth(clock) + 5000, { costUsd: 1.2 });
    await row('a', startOfMonth(clock) + 6000, { costUsd: 0.9 });
    const r = route([member(a, { limits: { costUsdPerMonth: 2 } }), member(b)]);
    expect((await r.complete(REQ)).providerId).toBe('b');

    // last month's spending does not count
    await db.table('_aiUsage').clear();
    await row('a', startOfMonth(clock) - 5000, { costUsd: 50 });
    expect((await r.complete(REQ)).providerId).toBe('a');
  });

  it('a limit of 0 disables a provider; no limit means unlimited', async () => {
    const a = fake('a', [ok()]);
    const b = fake('b', [ok()]);
    expect(
      (await route([member(a, { limits: { requestsPerDay: 0 } }), member(b)]).complete(REQ))
        .providerId,
    ).toBe('b');
    for (let i = 0; i < 50; i++) await row('b', startOfDay(clock) + i);
    expect((await route([member(b)]).complete(REQ)).providerId).toBe('b');
  });

  it('answers "limit-reached" without any call when all providers are used up', async () => {
    const a = fake('a', [ok()]);
    await row('a', startOfDay(clock) + 1);
    const r = route([member(a, { limits: { requestsPerDay: 1 } })]);
    await expect(r.complete(REQ)).rejects.toMatchObject({ code: 'limit-reached' });
    expect(a.complete).not.toHaveBeenCalled();
  });

  it('falls through from an exhausted provider to a working one after a failure', async () => {
    const a = fake('a', [ok()]);
    const b = fake('b', [err('server')]);
    const c = fake('c', [ok()]);
    await row('a', startOfDay(clock) + 1);
    const r = route([member(a, { limits: { requestsPerDay: 1 } }), member(b), member(c)]);
    const res = await r.complete(REQ);
    expect(res.providerId).toBe('c');
    expect(res.attempts?.map((x) => x.providerId)).toEqual(['b']);
  });
});

describe('router: costs', () => {
  it('prices the call with the provider price (free = 0, paid = tokens × price)', async () => {
    const paid = route([
      member(fake('p', [ok('m', { inputTokens: 1_000_000, outputTokens: 100_000 })]), {
        price: { inputPerMTok: 0.2, outputPerMTok: 0.6 },
      }),
    ]);
    expect((await paid.complete(REQ)).costUsd).toBeCloseTo(0.26);
    const free = route([
      member(fake('f', [ok()]), { price: { inputPerMTok: 0, outputPerMTok: 0 } }),
    ]);
    expect((await free.complete(REQ)).costUsd).toBe(0);
    const unknown = route([member(fake('u', [ok('mystery-model')]))]);
    expect((await unknown.complete(REQ)).costUsd).toBeUndefined();
  });
});
