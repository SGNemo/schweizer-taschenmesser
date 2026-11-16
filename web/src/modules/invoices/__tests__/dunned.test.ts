import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addLink } from '@/core/entitylinks';
import { amendCapture } from '@/quickCapture/targets';
import manifest from '../manifest';
import { migrations } from '../migrations';
import source, { hardDue, payRoute, planDetail } from '../plannable';
import { invoiceRepo } from '../repo';
import { invoiceSchema } from '../schema';

/**
 * Planner hub S1 (docs/design/planner-hub/CONCEPT-LINKS.md §2, L5–L7): a reminder is a state of the invoice;
 * what it claims are fields; the plan row's main action is a route.
 */
const ctx = { today: '2026-11-05', until: '2026-11-18' };
const add = (over: Record<string, unknown> = {}) =>
  invoiceRepo.create({
    payee: 'Stadtwerke',
    amountMinor: 8430,
    dueDate: '2026-11-02',
    status: 'open',
    ...over,
  } as never);

beforeEach(async () => {
  await db.table('invoices_invoice').clear();
  await db.table('_settings').clear();
  await db.table('_links').clear();
});

describe('L6: the reminder’s claims are fields', () => {
  it('the schema takes both, optional, cents and YYYY-MM-DD; version 5 with a step that changes nothing', async () => {
    const base = { payee: 'A', amountMinor: 100, dueDate: '2026-11-02' };
    expect(invoiceSchema.parse(base)).not.toHaveProperty('dunnedDueDate');
    expect(
      invoiceSchema.parse({ ...base, dunnedDueDate: '2026-11-20', dunnedAmountMinor: 9240 }),
    ).toMatchObject({ dunnedDueDate: '2026-11-20', dunnedAmountMinor: 9240 });
    expect(invoiceSchema.safeParse({ ...base, dunnedDueDate: '20.11.2026' }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...base, dunnedAmountMinor: 92.4 }).success).toBe(false);
    expect(manifest.version).toBe(5);
    const before = await add();
    await migrations![5]!({} as never);
    expect(await invoiceRepo.get(before.id)).toEqual(before);
  });

  it('they are money facts like level and day: in the import format, not in the assistant’s schema', () => {
    const shape = invoiceSchema.shape;
    for (const field of ['dunnedDueDate', 'dunnedAmountMinor', 'dunningLevel', 'dunnedAt'] as const)
      expect((shape[field].meta() as { internal?: boolean } | undefined)?.internal).toBeUndefined();
    const ai = Object.keys(manifest.aiSchema!.collections.invoice!.fields);
    expect(ai).not.toContain('dunnedDueDate');
    expect(ai).not.toContain('dunnedAmountMinor');
  });

  it('noting a reminder writes them; amount and due date stay; twice writes nothing; the undo resets them', async () => {
    const i = await add({ note: 'Kundennummer 4711' });
    const match = { id: i.id, payee: i.payee, dueDate: i.dueDate, restMinor: 8430 };
    const fields = {
      title: 'Stadtwerke',
      amountMinor: 9240,
      date: '2026-11-20',
      dunning: { level: 1, date: '2026-11-03' },
    };
    const saved = await amendCapture('invoice', fields, match as never);
    expect(await invoiceRepo.get(i.id)).toMatchObject({
      amountMinor: 8430,
      dueDate: '2026-11-02',
      dunningLevel: 1,
      dunnedAt: '2026-11-03',
      dunnedDueDate: '2026-11-20',
      dunnedAmountMinor: 9240,
    });
    const after = await invoiceRepo.get(i.id);
    const again = await amendCapture('invoice', fields, match as never);
    expect(again.existed).toBe(true);
    expect(await invoiceRepo.get(i.id)).toEqual(after);

    await saved.undo();
    const back = await invoiceRepo.get(i.id);
    expect(back).toMatchObject({ note: 'Kundennummer 4711', amountMinor: 8430 });
    expect(back?.dunnedDueDate).toBeUndefined();
    expect(back?.dunnedAmountMinor).toBeUndefined();
    expect(back?.dunningLevel).toBeUndefined();
  });

  it('a second reminder replaces the claim and its undo brings the first back; one without a deadline keeps it', async () => {
    const i = await add();
    const match = { id: i.id, payee: i.payee, dueDate: i.dueDate, restMinor: 8430 } as never;
    await amendCapture(
      'invoice',
      {
        title: 'Stadtwerke',
        amountMinor: 9240,
        date: '2026-11-20',
        dunning: { level: 1, date: '2026-11-03' },
      },
      match,
    );
    const second = await amendCapture(
      'invoice',
      {
        title: 'Stadtwerke',
        amountMinor: 9740,
        date: '2026-11-30',
        dunning: { level: 2, date: '2026-11-21' },
      },
      match,
    );
    expect(await invoiceRepo.get(i.id)).toMatchObject({
      dunningLevel: 2,
      dunnedDueDate: '2026-11-30',
      dunnedAmountMinor: 9740,
    });
    await second.undo();
    expect(await invoiceRepo.get(i.id)).toMatchObject({
      dunningLevel: 1,
      dunnedAt: '2026-11-03',
      dunnedDueDate: '2026-11-20',
      dunnedAmountMinor: 9240,
    });
    await amendCapture(
      'invoice',
      { title: 'Stadtwerke', dunning: { level: 2, date: '2026-11-22' } },
      match,
    );
    expect(await invoiceRepo.get(i.id)).toMatchObject({
      dunningLevel: 2,
      dunnedDueDate: '2026-11-20',
      dunnedAmountMinor: 9240,
    });
  });
});

describe('the plan row of a dunned invoice (step 3)', () => {
  it('hard due = the reminder’s deadline, else the invoice’s; priority 3 while dunned', async () => {
    expect(hardDue({ dueDate: '2026-11-02' })).toBe('2026-11-02');
    expect(hardDue({ dueDate: '2026-11-02', dunnedDueDate: '2026-11-20' })).toBe('2026-11-20');
    const plain = await add({ payee: 'Vermieter', dueDate: '2026-11-10' });
    const dunned = await add({
      dunningLevel: 1,
      dunnedAt: '2026-11-03',
      dunnedDueDate: '2026-11-20',
      dunnedAmountMinor: 9240,
    });
    const items = await source.list(ctx);
    expect(items.find((x) => x.id === plain.id)).toMatchObject({
      priority: 2,
      due: { date: '2026-11-10', hard: true },
    });
    expect(items.find((x) => x.id === plain.id)?.detail).toBeUndefined();
    const row = items.find((x) => x.id === dunned.id)!;
    expect(row).toMatchObject({
      // One thing, one key: the title and the id stay; the reminder is its detail.
      title: 'Stadtwerke bezahlen',
      priority: 3,
      due: { date: '2026-11-20', hard: true },
    });
    expect(row.detail).toMatch(/^Mahnung · 92,40\s€ bis 20\. Nov\.$/);
  });

  it('the detail reads the fields, and still the note line of a reminder noted before', () => {
    const base = { dunningLevel: 1, dunnedAt: '2026-11-03' };
    expect(planDetail({ ...base, dunnedAmountMinor: 9240 })).toMatch(/^Mahnung · 92,40\s€$/);
    expect(planDetail({ ...base, dunnedDueDate: '2026-11-20' })).toBe('Mahnung · bis 20. Nov.');
    // The fields win over an older note line.
    expect(
      planDetail({
        ...base,
        dunnedDueDate: '2026-11-20',
        dunnedAmountMinor: 9240,
        note: 'Mahnung vom 03.11.2026: 1,00 € bis 01.01.2027',
      }),
    ).toMatch(/92,40\s€ bis 20\. Nov\./);
    expect(planDetail({ ...base, note: 'Mahnung vom 03.11.2026: 92,40 € bis 20.11.2026' })).toBe(
      'Mahnung · 92,40 € bis 20.11.2026',
    );
    expect(planDetail({ ...base, note: 'eigene Notiz' })).toBe('Mahnung');
    expect(planDetail({ dunnedDueDate: '2026-11-20' })).toBeUndefined();
  });

  it('L7: „Bezahlt …“ is a route to this module’s pay step, never a callback; the links are handed over', async () => {
    const i = await add({ id: undefined });
    await addLink({
      from: { module: 'invoices', id: i.id },
      to: { module: 'mail', id: 'thr-1' },
      rel: 'origin',
      label: 'Ihre Rechnung',
      on: '2026-10-20',
    });
    const [row] = await source.list(ctx);
    expect(row!.action).toEqual({
      label: 'Bezahlt …',
      to: `/invoices?open=${i.id}&do=pay&from=plan`,
    });
    expect(payRoute('a b&do=x')).toBe('/invoices?open=a%20b%26do%3Dx&do=pay');
    expect(row!.links).toEqual([
      {
        to: { module: 'mail', id: 'thr-1' },
        rel: 'origin',
        label: 'Ihre Rechnung',
        on: '2026-10-20',
      },
    ]);
    expect(source.onDone).toBeUndefined();
  });
});
