/** The assistant with the router: fallbacks are accounted, the cache is shared between providers. */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { ask, type AskDeps } from './assistant';
import { clearCooldown, createRouter, type RouterMember } from './router';
import { AiError, type AiProvider, type CompletionResult } from './providers/types';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from './testing';
import { loadUsageRows, totalsByProvider, totalsOf } from './usage';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
  clearCooldown();
});
afterAll(() => setNow());

const QUESTION = 'Wie viel habe ich im September für Lebensmittel ausgegeben?';
const good: CompletionResult = {
  toolCalls: [
    {
      name: 'run_query',
      input: {
        module: 'finance',
        collection: 'transaction',
        filters: [{ field: 'kind', op: 'eq', value: 'expense' }],
        range: { relative: 'this_month' },
        aggregate: 'sum:amountMinor',
      },
    },
  ],
  text: '',
  usage: { inputTokens: 500, outputTokens: 30 },
  model: 'model-b',
};
const badIntent: CompletionResult = {
  toolCalls: [{ name: 'run_query', input: { collection: 'x' } }], // module missing
  text: '',
  usage: { inputTokens: 400, outputTokens: 10 },
  model: 'model-a',
};

function fake(
  id: string,
  steps: (CompletionResult | AiError)[],
): AiProvider & { complete: ReturnType<typeof vi.fn> } {
  const queue = [...steps];
  return {
    id,
    model: `${id}-model`,
    complete: vi.fn(async () => {
      const next = queue.length > 1 ? queue.shift()! : queue[0]!;
      if (next instanceof Error) throw next;
      return next;
    }),
  };
}
const member = (p: AiProvider, price?: RouterMember['entry']['price']): RouterMember => ({
  entry: { id: p.id, label: p.id, limits: {}, price },
  provider: p,
});
const deps = (provider: AiProvider): AskDeps => {
  const { manifests, known } = ctxFor();
  return { manifests, known, today: TODAY, provider, database: db };
};

describe('assistant with the fallback router', () => {
  it('falls back from a rate-limited provider and accounts errors, fallbacks and cost per provider', async () => {
    const a = fake('a', [new AiError('rate-limit', 'HTTP 429')]);
    const b = fake('b', [good]);
    const router = createRouter({
      members: [member(a), member(b, { inputPerMTok: 1, outputPerMTok: 2 })],
    });
    const res = await ask(QUESTION, deps(router));
    expect(res).toMatchObject({ ok: true, tier: 'model', usage: { model: 'model-b' } });

    const rows = await loadUsageRows(db);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.provider === 'a')).toMatchObject({
      outcome: 'error',
      errorCode: 'rate-limit',
    });
    expect(rows.find((r) => r.provider === 'b')).toMatchObject({
      outcome: 'ok',
      viaFallback: true,
      inputTokens: 500,
    });
    const per = totalsByProvider(rows);
    expect(per.get('a')).toMatchObject({ requests: 0, errors: 1 });
    expect(per.get('b')).toMatchObject({ requests: 1, errors: 0, fallbacks: 1 });
    expect(per.get('b')!.costUsd).toBeCloseTo(0.00056); // 500 × $1/M + 30 × $2/M
    expect(totalsOf(rows)).toMatchObject({ requests: 1, errors: 1, fallbacks: 1 });
  });

  it('tries the next provider when the answer is not a valid intent', async () => {
    const a = fake('a', [badIntent]);
    const b = fake('b', [good]);
    const res = await ask(QUESTION, deps(createRouter({ members: [member(a), member(b)] })));
    expect(res).toMatchObject({ ok: true, tier: 'model' });
    const rows = await loadUsageRows(db);
    expect(rows.find((r) => r.provider === 'a')).toMatchObject({
      outcome: 'error',
      errorCode: 'invalid-response',
    });
  });

  it('shares the cache between providers: a later question is answered without any call', async () => {
    const a = fake('a', [good]);
    const first = await ask(QUESTION, deps(createRouter({ members: [member(a)] })));
    expect(first).toMatchObject({ tier: 'model' });

    const other = fake('other', [good]);
    const second = await ask(
      QUESTION.toUpperCase(),
      deps(createRouter({ members: [member(other)] })),
    );
    expect(second).toMatchObject({ ok: true, tier: 'cache' });
    expect(other.complete).not.toHaveBeenCalled();
  });

  it('accounts every failed attempt when nobody answers, and reports "exhausted"', async () => {
    const a = fake('a', [new AiError('server', 'HTTP 500')]);
    const b = fake('b', [new AiError('network', 'offline')]);
    const res = await ask(QUESTION, deps(createRouter({ members: [member(a), member(b)] })));
    expect(res).toMatchObject({ ok: false, error: 'exhausted' });
    const rows = await loadUsageRows(db);
    expect(rows.map((r) => [r.provider, r.outcome, r.errorCode])).toEqual([
      ['a', 'error', 'server'],
      ['b', 'error', 'network'],
    ]);
  });

  it('a single provider keeps its specific error message code (e.g. rejected key)', async () => {
    const a = fake('a', [new AiError('auth', 'HTTP 401')]);
    const res = await ask(QUESTION, deps(createRouter({ members: [member(a)] })));
    expect(res).toMatchObject({ ok: false, error: 'auth' });
  });

  it('reports "limit-reached" when local limits stop every provider', async () => {
    const a = fake('a', [good]);
    const limited: RouterMember = {
      ...member(a),
      entry: { ...member(a).entry, limits: { requestsPerDay: 0 } },
    };
    const res = await ask(QUESTION, deps(createRouter({ members: [limited] })));
    expect(res).toMatchObject({ ok: false, error: 'limit-reached' });
    expect(a.complete).not.toHaveBeenCalled();
  });
});
