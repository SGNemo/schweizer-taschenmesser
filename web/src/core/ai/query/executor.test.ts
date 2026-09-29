import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from '../testing';
import { executeIntent } from './executor';
import { intentSchema, type IntentInput } from './schema';
import type { AiQueryError } from './types';
import { type AiResult } from './types';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
});
afterAll(() => setNow());

const run = (intent: IntentInput, enabled?: string[]): Promise<AiResult> =>
  executeIntent(intentSchema.parse(intent), ctxFor(enabled));

const query = (q: Record<string, unknown>, enabled?: string[]) =>
  run(
    { type: 'query', query: { module: 'invoices', collection: 'invoice', ...q } } as IntentInput,
    enabled,
  );

const titles = (r: AiResult) => (r.kind === 'rows' ? r.rows.map((x) => x.title) : []);
const code = async (p: Promise<unknown>) =>
  ((await p.catch((e: unknown) => e)) as AiQueryError).code;

describe('whitelist', () => {
  it('rejects unknown modules, collections and fields', async () => {
    expect(await code(query({ module: 'nope' }))).toBe('unknown-module');
    expect(await code(query({ collection: 'nope' }))).toBe('unknown-collection');
    expect(await code(query({ filters: [{ field: 'secret', op: 'eq', value: 'x' }] }))).toBe(
      'unknown-field',
    );
    expect(await code(query({ sort: { field: 'reference' } }))).toBe('unknown-field'); // in the Zod schema, not in the aiSchema
  });

  it('distinguishes a disabled module from an unknown one and never reads its data', async () => {
    const enabled = ['todos', 'calendar'];
    expect(await code(query({}, enabled))).toBe('inactive-module');
    const agenda = await run(
      { type: 'agenda', agenda: { from: '2026-09-25', to: '2026-10-10' } },
      enabled,
    );
    if (agenda.kind !== 'agenda') throw new Error('agenda expected');
    expect(agenda.items.some((i) => i.source === 'invoices')).toBe(false);
  });

  it('repairs letter case and snake_case field names', async () => {
    const r = await query({
      filters: [
        { field: 'due_date', op: 'lt', value: '2026-10-01' },
        { field: 'STATUS', op: 'eq', value: 'OPEN' },
      ],
    });
    expect(titles(r)).toEqual(['Vodafone']);
  });
});

describe('operators', () => {
  const invoiceTitles = async (filters: unknown[]) =>
    titles(await query({ filters, sort: { field: 'payee' } }));

  it('eq / ne / in on enums', async () => {
    expect(await invoiceTitles([{ field: 'status', op: 'eq', value: 'paid' }])).toEqual([
      'Telekom',
    ]);
    expect(await invoiceTitles([{ field: 'status', op: 'ne', value: 'paid' }])).toEqual([
      'Stadtwerke Musterstadt',
      'Vodafone',
    ]);
    expect(
      await invoiceTitles([{ field: 'status', op: 'in', value: ['paid', 'open'] }]),
    ).toHaveLength(3);
  });

  it('contains ignores case and diacritics', async () => {
    expect(await invoiceTitles([{ field: 'payee', op: 'contains', value: 'STADTWERKE' }])).toEqual([
      'Stadtwerke Musterstadt',
    ]);
  });

  it('compares numbers and dates, between is inclusive', async () => {
    expect(await invoiceTitles([{ field: 'amountMinor', op: 'gt', value: 3999 }])).toEqual([
      'Stadtwerke Musterstadt',
    ]);
    expect(
      await invoiceTitles([{ field: 'amountMinor', op: 'between', value: [2500, 3999] }]),
    ).toEqual(['Telekom', 'Vodafone']);
    expect(await invoiceTitles([{ field: 'dueDate', op: 'gte', value: '2026-09-25' }])).toEqual([
      'Stadtwerke Musterstadt',
      'Vodafone',
    ]);
  });

  it('coerces string numbers and booleans, rejects impossible values', async () => {
    expect(await invoiceTitles([{ field: 'amountMinor', op: 'eq', value: '3999' }])).toEqual([
      'Vodafone',
    ]);
    const tasks = await run({
      type: 'query',
      query: {
        module: 'todos',
        collection: 'task',
        filters: [{ field: 'done', op: 'eq', value: 'nein' }],
      },
    } as IntentInput);
    expect(titles(tasks)).toHaveLength(2);
    expect(await code(query({ filters: [{ field: 'amountMinor', op: 'eq', value: 12.5 }] }))).toBe(
      'bad-value',
    ); // cents are integers
    expect(await code(query({ filters: [{ field: 'dueDate', op: 'eq', value: 'morgen' }] }))).toBe(
      'bad-value',
    );
    expect(
      await code(query({ filters: [{ field: 'status', op: 'eq', value: 'cancelled' }] })),
    ).toBe('bad-value');
    expect(
      await code(query({ filters: [{ field: 'amountMinor', op: 'between', value: [1] }] })),
    ).toBe('bad-value');
  });

  it('rejects operators that do not fit the type', async () => {
    expect(
      await code(query({ filters: [{ field: 'amountMinor', op: 'contains', value: '9' }] })),
    ).toBe('bad-operator');
    expect(await code(query({ filters: [{ field: 'status', op: 'lt', value: 'open' }] }))).toBe(
      'bad-operator',
    );
    const events = run({
      type: 'query',
      query: {
        module: 'calendar',
        collection: 'event',
        filters: [{ field: 'recurrence', op: 'eq', value: 'x' }],
      },
    } as IntentInput);
    expect(await code(events)).toBe('bad-operator');
  });
});

describe('ranges, sort, limit', () => {
  it('relative ranges use the date field of the collection', async () => {
    expect(titles(await query({ range: { relative: 'overdue' } }))).toEqual([
      'Telekom',
      'Vodafone',
    ]);
    expect(
      titles(
        await query({
          range: { relative: 'this_month' },
          filters: [{ field: 'status', op: 'eq', value: 'open' }],
        }),
      ),
    ).toEqual(['Vodafone']);
    expect(titles(await query({ range: { relative: 'next_7_days' } }))).toEqual([
      'Stadtwerke Musterstadt',
    ]);
  });

  it('range on a non-date field is rejected', async () => {
    expect(await code(query({ range: { field: 'payee', relative: 'today' } }))).toBe(
      'no-date-field',
    );
    expect(
      await code(
        run({
          type: 'query',
          query: { module: 'todos', collection: 'list', range: { relative: 'today' } },
        } as IntentInput),
      ),
    ).toBe('no-date-field');
  });

  it('sorts (missing values last) and limits, reporting the total', async () => {
    const r = await query({ sort: { field: 'amountMinor', dir: 'desc' }, limit: 2 });
    if (r.kind !== 'rows') throw new Error('rows expected');
    expect(r.rows.map((x) => x.title)).toEqual(['Stadtwerke Musterstadt', 'Vodafone']);
    expect(r.total).toBe(3);
    expect(r.rows[0]!.fields.map((f) => f.label)).toContain('Betrag');
    expect(r.rows[0]!.fields.find((f) => f.label === 'Betrag')!.value).toMatch(/89,90/);
  });

  it('ignores deleted records', async () => {
    const { invoiceRepo } = await import('@/modules/invoices/repo');
    const vodafone = (await invoiceRepo.active().toArray()).find((i) => i.payee === 'Vodafone')!;
    await invoiceRepo.remove(vodafone.id);
    expect(titles(await query({}))).not.toContain('Vodafone');
  });
});

describe('aggregates', () => {
  it('counts and sums money', async () => {
    const count = await query({
      filters: [{ field: 'status', op: 'eq', value: 'open' }],
      aggregate: 'count',
    });
    expect(count).toMatchObject({ kind: 'aggregate', value: '2' });
    const sum = await query({
      filters: [{ field: 'status', op: 'eq', value: 'open' }],
      aggregate: 'sum:amountMinor',
    });
    if (sum.kind !== 'aggregate') throw new Error('aggregate expected');
    expect(sum.value).toMatch(/129,89/);
  });

  it('only sums numeric fields', async () => {
    expect(await code(query({ aggregate: 'sum:payee' }))).toBe('bad-aggregate');
    expect(await code(query({ aggregate: 'sum:nope' }))).toBe('unknown-field');
  });
});

describe('agenda', () => {
  it('collects entries of all enabled modules, including recurring ones', async () => {
    const r = await run({ type: 'agenda', agenda: { relative: 'today' } });
    if (r.kind !== 'agenda') throw new Error('agenda expected');
    expect(r.from).toBe(TODAY);
    expect(r.items.map((i) => i.title)).toEqual(expect.arrayContaining(['Milch kaufen', 'Yoga']));
    expect(r.items.every((i) => i.date === TODAY)).toBe(true);
  });

  it('restricts to sources and validates them', async () => {
    const r = await run({
      type: 'agenda',
      agenda: { relative: 'this_month', sources: ['invoices'] },
    });
    if (r.kind !== 'agenda') throw new Error('agenda expected');
    expect(new Set(r.items.map((i) => i.source))).toEqual(new Set(['invoices']));
    expect(
      await code(run({ type: 'agenda', agenda: { relative: 'today', sources: ['nope'] } })),
    ).toBe('unknown-module');
  });

  it('rejects absurd ranges', async () => {
    expect(
      await code(run({ type: 'agenda', agenda: { from: '2020-01-01', to: '2026-01-01' } })),
    ).toBe('bad-value');
  });
});

describe('computed views', () => {
  it('answers balance, costs and open invoices locally', async () => {
    const balance = await run({ type: 'computed', module: 'finance', name: 'balance' });
    if (balance.kind !== 'computed') throw new Error('computed expected');
    const line = (label: string) => balance.lines.find((l) => l.label === label)?.value;
    expect(line('Kontostand')).toMatch(/3\.455,00/); // 1000 + 2500 - 45
    expect(line('Verfügbar')).toBeDefined(); // open invoices are deducted

    const costs = await run({ type: 'computed', module: 'subscriptions', name: 'costs' });
    if (costs.kind !== 'computed') throw new Error('computed expected');
    expect(costs.lines.find((l) => l.label === 'Pro Monat')!.value).toMatch(/12,99/);

    const open = await run({ type: 'computed', module: 'invoices', name: 'open' });
    if (open.kind !== 'computed') throw new Error('computed expected');
    expect(open.lines.find((l) => l.label === 'Summe offen')!.value).toMatch(/129,89/);
    expect(open.lines.at(-1)!.value).toContain('Vodafone');
  });

  it('rejects unknown views', async () => {
    expect(await code(run({ type: 'computed', module: 'finance', name: 'secrets' }))).toBe(
      'unknown-computed',
    );
    expect(await code(run({ type: 'computed', module: 'todos', name: 'balance' }))).toBe(
      'unknown-computed',
    );
  });
});

describe('messages', () => {
  it('passes plain model text through', async () => {
    expect(await run({ type: 'message', text: 'Das kann ich nicht.' })).toEqual({
      kind: 'message',
      text: 'Das kann ich nicht.',
    });
  });
});
