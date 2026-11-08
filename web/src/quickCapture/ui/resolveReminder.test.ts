import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { resolveReminder, type LookupResult } from './batch';

// The save-time check must save what the preview showed (council round 2). Invented data.
beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
  await enableModule(getManifest('invoices')!);
});
afterEach(() => setNow());

const repo = () => createCollectionRepo(getManifest('invoices')!, 'invoice');
const add = (id: string, dueDate: string) =>
  repo().createMany([
    { id, data: { payee: 'Stadtwerke', amountMinor: 8430, dueDate, status: 'open' } },
  ]);
const fields = {
  title: 'Stadtwerke',
  amountMinor: 8740,
  dunning: { level: 1, date: '2026-09-30' },
};
const all = ['todo', 'invoice'] as const;

describe('resolveReminder', () => {
  it('the shown invoice was paid and another one fits now: a ToDo, not a silent note on the other', async () => {
    await add('a', '2026-08-15');
    await add('b', '2026-09-15');
    const shown = {
      match: { id: 'a', payee: 'Stadtwerke', dueDate: '2026-08-15', restMinor: 8430 },
    };
    await repo().update('a', { status: 'paid', paidAt: '2026-09-30' });
    const plan = await resolveReminder('invoice', fields, [...all], shown);
    expect(plan).toMatchObject({ type: 'todo', fields: { title: 'Mahnung Stadtwerke prüfen' } });
    expect(plan.amend).toBeUndefined();
  });

  it('the shown invoice still fits: noted on it', async () => {
    await add('a', '2026-08-15');
    const shown = {
      match: { id: 'a', payee: 'Stadtwerke', dueDate: '2026-08-15', restMinor: 8430 },
    };
    expect((await resolveReminder('invoice', fields, [...all], shown)).amend?.id).toBe('a');
  });

  it('the preview was unsure (or promised a new invoice) and one fits now: still the ToDo, no unseen note', async () => {
    await add('a', '2026-08-15');
    const previews: LookupResult[] = [{ candidates: [] }, 'failed', 'none'];
    for (const preview of previews) {
      const plan = await resolveReminder('invoice', fields, [...all], preview);
      expect(plan.type).toBe('todo');
      expect(plan.amend).toBeUndefined();
    }
  });
});
