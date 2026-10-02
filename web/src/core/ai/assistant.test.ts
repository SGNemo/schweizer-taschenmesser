import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { ask, type AskDeps } from './assistant';
import { AiError, type AiProvider, type CompletionResult } from './providers/types';
import { loadUsageTotals } from './usage';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from './testing';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
});
afterAll(() => setNow());

function fakeProvider(
  results: (CompletionResult | Error)[],
): AiProvider & { complete: ReturnType<typeof vi.fn> } {
  const queue = [...results];
  return {
    id: 'claude',
    model: 'claude-haiku-4-5',
    complete: vi.fn(async () => {
      const next = queue.shift();
      if (!next) throw new Error('no more results');
      if (next instanceof Error) throw next;
      return next;
    }),
  };
}

const toolCall = (
  name: string,
  input: unknown,
  usage = { inputTokens: 500, outputTokens: 30 },
): CompletionResult => ({
  toolCalls: [{ name, input }],
  text: '',
  usage,
  model: 'claude-haiku-4-5-20251001',
});

const deps = (over: Partial<AskDeps> = {}): AskDeps => {
  const { manifests, known } = ctxFor();
  return { manifests, known, today: TODAY, database: db, ...over };
};

const COMPLEX = 'Wie viel habe ich im September für Lebensmittel ausgegeben?';

describe('assistant pipeline', () => {
  it('answers stage-1 questions locally without touching the model', async () => {
    const provider = fakeProvider([]);
    const res = await ask('Was steht heute an?', deps({ provider }));
    expect(res).toMatchObject({ ok: true, tier: 'local', result: { kind: 'agenda' } });
    expect(provider.complete).not.toHaveBeenCalled();
    expect(await loadUsageTotals(db)).toMatchObject({ requests: 0, cacheHits: 0 });
  });

  it('searches for short free text', async () => {
    const res = await ask('Netflix', deps({ provider: fakeProvider([]) }));
    expect(res).toMatchObject({ ok: true, tier: 'local', result: { kind: 'rows', total: 1 } });
  });

  it('asks the model for complex questions, counts tokens and caches the structured query', async () => {
    const provider = fakeProvider([
      toolCall('run_query', {
        module: 'finance',
        collection: 'transaction',
        filters: [{ field: 'kind', op: 'eq', value: 'expense' }],
        range: { relative: 'this_month' },
        aggregate: 'sum:amountMinor',
      }),
    ]);
    const first = await ask(COMPLEX, deps({ provider }));
    expect(first).toMatchObject({
      ok: true,
      tier: 'model',
      usage: { inputTokens: 500, outputTokens: 30 },
    });
    if (!first.ok || first.result.kind !== 'aggregate') throw new Error('aggregate expected');
    expect(first.result.value).toMatch(/45,00/);

    // What goes to the model: schema + question, never data.
    const sent = provider.complete.mock.calls[0]![0] as { system: string; user: string };
    expect(sent.user).toContain(COMPLEX);
    expect(sent.system + sent.user).not.toContain('Supermarkt');

    // Same question again: cache hit, no model call – and the answer follows live data.
    const { transactionRepo } = await import('@/modules/finance/repo');
    await transactionRepo.create({
      accountId: 'acc-main',
      kind: 'expense',
      amountMinor: 500,
      date: '2026-09-25',
    });
    const second = await ask(`  ${COMPLEX.toUpperCase()} `, deps({ provider }));
    expect(second).toMatchObject({ ok: true, tier: 'cache' });
    if (!second.ok || second.result.kind !== 'aggregate') throw new Error('aggregate expected');
    expect(second.result.value).toMatch(/50,00/);
    expect(provider.complete).toHaveBeenCalledTimes(1);

    expect(await loadUsageTotals(db)).toMatchObject({
      requests: 1,
      cacheHits: 1,
      inputTokens: 500,
      outputTokens: 30,
    });
  });

  it('does not reuse the cache on another day', async () => {
    const provider = fakeProvider([
      toolCall('show_agenda', { relative: 'tomorrow' }),
      toolCall('show_agenda', { relative: 'tomorrow' }),
    ]);
    await ask('Gibt es nächste Woche irgendetwas Besonderes zu beachten?', deps({ provider }));
    await ask(
      'Gibt es nächste Woche irgendetwas Besonderes zu beachten?',
      deps({ provider, today: '2026-09-30' }),
    );
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid model output without caching it', async () => {
    const provider = fakeProvider([
      toolCall('run_query', {
        module: 'invoices',
        collection: 'invoice',
        filters: [{ field: 'iban', op: 'eq', value: 'x' }],
      }),
      toolCall('run_query', {
        module: 'invoices',
        collection: 'invoice',
        filters: [{ field: 'iban', op: 'eq', value: 'x' }],
      }),
    ]);
    const first = await ask(COMPLEX, deps({ provider }));
    expect(first).toEqual({ ok: false, error: 'unknown-field', detail: 'iban' });
    await ask(COMPLEX, deps({ provider }));
    expect(provider.complete).toHaveBeenCalledTimes(2); // nothing cached
    expect(await loadUsageTotals(db)).toMatchObject({ requests: 2 }); // but the tokens were spent
  });

  it('reports malformed tool calls and empty answers', async () => {
    const bad = await ask(COMPLEX, deps({ provider: fakeProvider([toolCall('rm_rf', {})]) }));
    expect(bad).toMatchObject({ ok: false, error: 'invalid-answer' });
    const empty = await ask(
      COMPLEX,
      deps({
        provider: fakeProvider([
          { toolCalls: [], text: '', usage: { inputTokens: 1, outputTokens: 1 }, model: 'm' },
        ]),
      }),
    );
    expect(empty).toEqual({ ok: false, error: 'no-answer' });
  });

  it('shows plain model text as a message', async () => {
    const provider = fakeProvider([
      {
        toolCalls: [],
        text: 'Das weiß ich nicht.',
        usage: { inputTokens: 400, outputTokens: 8 },
        model: 'm',
      },
    ]);
    expect(await ask(COMPLEX, deps({ provider }))).toMatchObject({
      ok: true,
      tier: 'model',
      result: { kind: 'message', text: 'Das weiß ich nicht.' },
    });
  });

  it('turns create_entry into a confirmation, saving nothing', async () => {
    const provider = fakeProvider([
      toolCall('create_entry', {
        module: 'calendar',
        collection: 'event',
        data: {
          title: 'Miete',
          startDate: '2026-10-01',
          recurrence: { freq: 'monthly', byMonthDay: 1 },
        },
      }),
    ]);
    const before = await db.table('calendar_event').count();
    const res = await ask('Erinnere mich jeden 1. an Miete', deps({ provider }));
    expect(res).toMatchObject({
      ok: true,
      tier: 'model',
      result: { kind: 'create', prepared: { label: 'Termin' } },
    });
    expect(await db.table('calendar_event').count()).toBe(before);
  });

  it('falls back to a search (with a hint) when no model is configured', async () => {
    const res = await ask('Wann muss ich das Auto zum Tüv bringen', deps());
    expect(res).toMatchObject({
      ok: true,
      tier: 'local',
      hint: 'no-model',
      result: { kind: 'rows' },
    });
  });

  it('forceModel skips the shortcuts', async () => {
    const provider = fakeProvider([toolCall('show_agenda', { relative: 'today' })]);
    const res = await ask('Netflix', deps({ provider, forceModel: true }));
    expect(res).toMatchObject({ ok: true, tier: 'model' });
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it('maps provider failures to error codes', async () => {
    for (const code of ['auth', 'rate-limit', 'network'] as const) {
      const res = await ask(COMPLEX, deps({ provider: fakeProvider([new AiError(code)]) }));
      expect(res).toMatchObject({ ok: false, error: code });
    }
  });

  it('tells when the needed module is disabled', async () => {
    const { manifests, known } = ctxFor(['todos']);
    const res = await ask('offene Rechnungen', { manifests, known, today: TODAY, database: db });
    expect(res).toMatchObject({ ok: false, error: 'inactive-module' });
  });

  it('rethrows programming errors instead of hiding them', async () => {
    const provider = fakeProvider([new TypeError('bug')]);
    await expect(ask(COMPLEX, deps({ provider }))).rejects.toThrow('bug');
  });
});
