import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { clearAll, ctxFor, useFixedClock } from '../testing';
import { commitCreate, prepareCreate } from './create';
import { executeIntent } from './executor';
import type { AiQueryError } from './types';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
});
afterAll(() => setNow());

const ctx = () => ctxFor();
const code = async (p: Promise<unknown>) =>
  ((await p.catch((e: unknown) => e)) as AiQueryError).code;

describe('prepareCreate', () => {
  it('turns "remind me on the 1st for rent" into a validated calendar entry without saving it', async () => {
    const prepared = await prepareCreate(
      {
        module: 'calendar',
        collection: 'event',
        data: {
          title: 'Miete überweisen',
          startDate: '2026-10-01',
          recurrence: { freq: 'monthly', byMonthDay: 1 },
        },
      },
      ctx(),
    );
    expect(prepared.label).toBe('Termin');
    expect(prepared.data).toMatchObject({
      title: 'Miete überweisen',
      allDay: false,
      recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
    });
    expect(prepared.preview.map((p) => p.label)).toEqual(
      expect.arrayContaining(['Titel', 'Datum', 'Wiederholung']),
    );
    expect(prepared.preview.find((p) => p.label === 'Wiederholung')!.value).toContain('Monat');
    expect(await db.table('calendar_event').count()).toBe(0);
  });

  it('fills defaults the model cannot know (inbox list, primary account)', async () => {
    const task = await prepareCreate(
      { module: 'todos', collection: 'task', data: { title: 'Zahnarzt anrufen' } },
      ctx(),
    );
    expect(task.data.listId).toBe('inbox');
    const tx = await prepareCreate(
      {
        module: 'finance',
        collection: 'transaction',
        data: { kind: 'expense', amountMinor: 1250, date: '2026-09-29', payee: 'Bäcker' },
      },
      ctx(),
    );
    expect(tx.data.accountId).toBe('acc-main');
  });

  it('rejects incomplete or invalid entries', async () => {
    expect(
      await code(
        prepareCreate({ module: 'calendar', collection: 'event', data: { title: 'x' } }, ctx()),
      ),
    ).toBe('invalid-entry'); // no startDate
    expect(
      await code(
        prepareCreate(
          {
            module: 'invoices',
            collection: 'invoice',
            data: { payee: 'X', amountMinor: 0, dueDate: '2026-10-01' },
          },
          ctx(),
        ),
      ),
    ).toBe('invalid-entry');
    expect(
      await code(
        prepareCreate(
          {
            module: 'invoices',
            collection: 'invoice',
            data: { payee: 'X', amountMinor: 1200, dueDate: '01.10.2026' },
          },
          ctx(),
        ),
      ),
    ).toBe('bad-value');
  });

  it('only accepts whitelisted fields and valid recurrence rules', async () => {
    expect(
      await code(
        prepareCreate(
          { module: 'todos', collection: 'task', data: { title: 'x', listId: 'evil' } },
          ctx(),
        ),
      ),
    ).toBe('unknown-field');
    expect(
      await code(
        prepareCreate(
          {
            module: 'calendar',
            collection: 'event',
            data: { title: 'x', startDate: '2026-10-01', recurrence: { freq: 'sometimes' } },
          },
          ctx(),
        ),
      ),
    ).toBe('bad-value');
  });

  it('does not create entries in disabled modules', async () => {
    expect(
      await code(
        prepareCreate({ module: 'invoices', collection: 'invoice', data: {} }, ctxFor(['todos'])),
      ),
    ).toBe('inactive-module');
  });

  it('is what executeIntent returns for a create intent', async () => {
    const r = await executeIntent(
      { type: 'create', module: 'todos', collection: 'task', data: { title: 'Brot' } },
      ctx(),
    );
    expect(r.kind).toBe('create');
  });
});

describe('commitCreate', () => {
  it('writes through the module repo (envelope, HLC stamps, outbox)', async () => {
    const prepared = await prepareCreate(
      {
        module: 'calendar',
        collection: 'event',
        data: { title: 'Miete', startDate: '2026-10-01' },
      },
      ctx(),
    );
    const id = await commitCreate(prepared, ctx());
    const row = (await db.table('calendar_event').get(id)) as Record<string, unknown>;
    expect(row).toMatchObject({ title: 'Miete', deletedAt: null });
    expect(Object.keys(row._f as object)).toContain('title');
    expect(await db.table('_outbox').get(['calendar_event', id])).toBeDefined();
  });
});
