import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import manifest from '../manifest';
import source from '../plannable';
import { invoiceRepo } from '../repo';

const ctx = { today: '2026-11-09', until: '2026-11-22' };
const add = (over: Record<string, unknown> = {}) =>
  invoiceRepo.create({
    payee: 'Stadtwerke',
    amountMinor: 8990,
    dueDate: '2026-11-12',
    status: 'open',
    ...over,
  } as never);

beforeEach(async () => {
  await db.table('invoices_invoice').clear();
  await db.table('_settings').clear();
});

describe('invoices as a planner source', () => {
  it('lists open invoices due within the plan as „<Empfänger> bezahlen“, 10 Min, prio 2, hard due', async () => {
    const a = await add();
    const late = await add({ payee: 'Vermieter', dueDate: '2026-11-01' });
    await add({ payee: 'Bezahlt', status: 'paid', paidAt: '2026-11-02' });
    await add({ payee: 'Später', dueDate: '2026-12-20' });
    const items = await source.list(ctx);
    expect(items.map((i) => i.title).sort()).toEqual(['Stadtwerke bezahlen', 'Vermieter bezahlen']);
    expect(items.find((i) => i.id === a.id)).toMatchObject({
      kind: 'invoice',
      to: `/invoices?open=${a.id}`,
      durationMin: 10,
      priority: 2,
      due: { date: '2026-11-12', hard: true },
    });
    // Overdue stays in (a hard due in the past is placed late, never dropped).
    expect(items.find((i) => i.id === late.id)?.due).toEqual({ date: '2026-11-01', hard: true });
  });

  it('a paid invoice leaves the plan; nothing is written back (no tick, no date)', async () => {
    const a = await add();
    await invoiceRepo.update(a.id, { status: 'paid', paidAt: '2026-11-09' });
    expect(await source.list(ctx)).toEqual([]);
    expect(source.onDone).toBeUndefined();
    expect(source.onAssign).toBeUndefined();
    expect(source.onEstimate).toBeUndefined();
  });

  it('„Im Plan zeigen“ off → no items; the manifest offers the contribution', async () => {
    await add();
    await setSettings('module.invoices', { showInPlan: false });
    expect(await source.list(ctx)).toEqual([]);
    expect(manifest.contributions?.plannable).toBeDefined();
    expect(manifest.settings?.defaults.showInPlan).toBe(true);
  });
});
