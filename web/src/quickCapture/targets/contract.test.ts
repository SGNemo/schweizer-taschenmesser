import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { createCollectionRepo } from '@/core/db/repo';
import { setNow } from '@/core/time/now';
import { amendCapture, captureId, reinstateCapture, saveCapture, saveCaptures } from './index';
import { findOpenInvoice } from './lookup';

// „Kopf leer“ package 2: create-if-absent ids, the open-invoice lookup and `amend`. Invented data.
const ON = { todos: true, calendar: true, invoices: true, finance: true, planner: true };
const TODAY = '2026-09-30';

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  for (const m of visibleManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  await db.table('_outbox').clear();
});

const rows = (table: string) => db.table(table).toArray();
const live = async (table: string) => (await rows(table)).filter((r) => r.deletedAt === null);
const invoiceRepo = () => createCollectionRepo(getManifest('invoices')!, 'invoice');

async function invoice(id: string, data: Record<string, unknown>) {
  await invoiceRepo().createMany([
    { id, data: { status: 'open', amountMinor: 8430, dueDate: '2026-09-15', ...data } },
  ]);
}

describe('captureId', () => {
  it('the same parts give one id, 16 hex characters', async () => {
    const a = await captureId(['mail', 'thread-1']);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await captureId(['mail', 'thread-1'])).toBe(a);
    expect(await captureId(['mail', 'thread-2'])).not.toBe(a);
  });
});

describe('create-if-absent (SaveOptions.id)', () => {
  it('writes once; a live id stops and registers no undo', async () => {
    const first = await saveCapture('todo', { title: 'Antworten' }, { states: ON, id: 't1' });
    expect(first.existed).toBeUndefined();
    const again = await saveCapture('todo', { title: 'Anders' }, { states: ON, id: 't1' });
    expect(again.existed).toBe(true);
    await again.undo();
    const [task] = await live('todos_task');
    expect(task).toMatchObject({ id: 't1', title: 'Antworten' });
  });

  it('a tombstone is reported, never revived', async () => {
    const first = await saveCapture('todo', { title: 'Antworten' }, { states: ON, id: 't1' });
    await first.undo();
    const again = await saveCapture('todo', { title: 'Antworten' }, { states: ON, id: 't1' });
    expect(again.existed).toBe('tombstone');
    expect(await live('todos_task')).toHaveLength(0);
  });

  it('a two-stage save stops both stages for an existing id', async () => {
    await saveCapture('todo', { title: 'Steuer' }, { states: ON, id: 'p1' });
    const saved = await saveCapture('plan', { title: 'Steuer' }, { states: ON, id: 'p1' });
    expect(saved.existed).toBe(true);
    expect(await rows('planner_item')).toHaveLength(0);
  });

  it('the invoice target with a live and with a tombstoned id', async () => {
    const fields = { title: 'Stadtwerke', amountMinor: 8430, date: '2026-10-15' };
    const a = await saveCapture('invoice', fields, { states: ON, id: 'i1' });
    expect((await saveCapture('invoice', fields, { states: ON, id: 'i1' })).existed).toBe(true);
    await a.undo();
    expect((await saveCapture('invoice', fields, { states: ON, id: 'i1' })).existed).toBe(
      'tombstone',
    );
    expect(await live('invoices_invoice')).toHaveLength(0);
  });

  it('a batch with one existing id writes the rest and rolls back without touching it', async () => {
    await saveCapture('todo', { title: 'Da' }, { states: ON, id: 'old' });
    const saved = await saveCaptures(
      [
        { type: 'todo', fields: { title: 'Da' }, id: 'old' },
        { type: 'todo', fields: { title: 'Neu' }, id: 'new' },
      ],
      'Da\nNeu',
      { states: ON },
    );
    expect(saved.count).toBe(1);
    await saved.undo();
    expect((await live('todos_task')).map((t) => t.id)).toEqual(['old']);

    // Rollback: the failing third entry takes back „neu2“ but never the existing one.
    await expect(
      saveCaptures(
        [
          { type: 'todo', fields: { title: 'Da' }, id: 'old' },
          { type: 'todo', fields: { title: 'Neu' }, id: 'new2' },
          { type: 'todo', fields: { title: ' ' } },
        ],
        'x',
        { states: ON },
      ),
    ).rejects.toBeTruthy();
    expect((await live('todos_task')).map((t) => t.id)).toEqual(['old']);
  });

  it('reinstateCapture brings back both records of a plan entry; undo deletes both again', async () => {
    const saved = await saveCapture('plan', { title: 'Steuer' }, { states: ON, id: 'p2' });
    await saved.undo();
    expect(await live('todos_task')).toHaveLength(0);
    const back = await reinstateCapture('plan', 'p2', { states: ON });
    expect((await live('todos_task')).map((t) => t.id)).toEqual(['p2']);
    expect((await live('planner_item')).map((t) => t.id)).toEqual(['todos:p2']);
    await back.undo();
    expect(await live('todos_task')).toHaveLength(0);
    expect(await live('planner_item')).toHaveLength(0);
  });
});

describe('findOpenInvoice', () => {
  const opts = { today: TODAY, states: ON };

  it('nothing while invoices are off; only a paid one with that name is a question, not a match', async () => {
    await invoice('a', { payee: 'Stadtwerke Musterstadt GmbH' });
    expect(
      await findOpenInvoice({ title: 'Stadtwerke' }, { today: TODAY, states: { invoices: false } }),
    ).toBeUndefined();
    await invoiceRepo().update('a', { status: 'paid', paidAt: TODAY });
    expect(await findOpenInvoice({ title: 'Stadtwerke' }, opts)).toEqual({ candidates: [] });
  });

  it('payee prefix with an amount between the rest and the rest plus a fee', async () => {
    await invoice('a', {
      payee: 'Stadtwerke Musterstadt GmbH',
      payments: [{ id: 'p', date: '2026-09-10', amountMinor: 1000 }],
    });
    const hit = await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 8740 }, opts);
    expect(hit).toEqual({
      match: {
        id: 'a',
        payee: 'Stadtwerke Musterstadt GmbH',
        dueDate: '2026-09-15',
        restMinor: 7430,
      },
    });
    // Outside the window the payee is still known: a question (candidates), never a match.
    for (const amountMinor of [5000, 99000])
      expect(await findOpenInvoice({ title: 'Stadtwerke', amountMinor }, opts)).toMatchObject({
        candidates: [{ id: 'a' }],
      });
  });

  it('also the creditor behind „im Auftrag von“, and a reference first', async () => {
    await invoice('a', { payee: 'Inkasso Nord im Auftrag von Stadtwerke Musterstadt' });
    await invoice('b', { payee: 'Telekom', reference: 'RE-2026-0815', amountMinor: 4590 });
    expect(await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 8430 }, opts)).toMatchObject({
      match: { id: 'a' },
    });
    expect(await findOpenInvoice({ title: 'RE-2026-0815 Mobilfunk' }, opts)).toMatchObject({
      match: { id: 'b' },
    });
  });

  it('the oldest overdue wins; a tie comes back as candidates', async () => {
    await invoice('a', { payee: 'Stadtwerke', dueDate: '2026-08-15' });
    await invoice('b', { payee: 'Stadtwerke', dueDate: '2026-09-15' });
    expect(await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 8430 }, opts)).toMatchObject({
      match: { id: 'a' },
    });
    await invoice('c', { payee: 'Stadtwerke', dueDate: '2026-08-15' });
    const tie = await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 8430 }, opts);
    expect(tie && 'candidates' in tie && tie.candidates.map((x) => x.id).sort()).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('amend (a reminder on its open invoice)', () => {
  const match = { id: 'a', payee: 'Stadtwerke', dueDate: '2026-09-15', restMinor: 8430 };
  const fields = { title: 'Stadtwerke', amountMinor: 8740, dunning: { level: 1, date: TODAY } };

  it('writes level, day and one note line – never amount or due date; noting twice does nothing', async () => {
    await invoice('a', { payee: 'Stadtwerke', note: 'Kundennummer 12' });
    const saved = await amendCapture('invoice', fields, match, { states: ON });
    expect(saved.amended).toBe(true);
    const row = await invoiceRepo().get('a');
    expect(row).toMatchObject({
      amountMinor: 8430,
      dueDate: '2026-09-15',
      dunningLevel: 1,
      dunnedAt: TODAY,
    });
    expect(String(row!.note).split('\n')).toHaveLength(2);
    expect((await amendCapture('invoice', fields, match, { states: ON })).existed).toBe(true);
    expect((await invoiceRepo().get('a'))!.dunningLevel).toBe(1);
  });

  it('undo takes back only its own line and values, also after an edit in between; never removes', async () => {
    await invoice('a', { payee: 'Stadtwerke', dunningLevel: 1, dunnedAt: '2026-09-20' });
    const saved = await amendCapture('invoice', fields, match, { states: ON });
    await invoiceRepo().update('a', {
      note: `${(await invoiceRepo().get('a'))!.note}\nAngerufen`,
      dunningLevel: 3,
    });
    await saved.undo();
    const row = await invoiceRepo().get('a');
    expect(row).toBeTruthy();
    expect(row!.note).toBe('Angerufen');
    // The level was changed by hand since: it stays; the day still held what was written: it goes back.
    expect(row).toMatchObject({ dunningLevel: 3, dunnedAt: '2026-09-20' });
  });

  it('a paid or deleted invoice throws stale; the batch then saves the fallback', async () => {
    await invoice('a', { payee: 'Stadtwerke' });
    await invoiceRepo().update('a', { status: 'paid', paidAt: TODAY });
    await expect(amendCapture('invoice', fields, match, { states: ON })).rejects.toMatchObject({
      code: 'stale',
    });
    const saved = await saveCaptures(
      [
        {
          type: 'invoice',
          fields,
          amend: match,
          fallback: { type: 'todo', fields: { title: 'Mahnung Stadtwerke prüfen' } },
        },
        { type: 'todo', fields: { title: 'Müll runterbringen' } },
      ],
      'x',
      { states: ON },
    );
    expect(saved.count).toBe(2);
    expect((await live('todos_task')).map((t) => t.title).sort()).toEqual([
      'Mahnung Stadtwerke prüfen',
      'Müll runterbringen',
    ]);
  });

  it('batch undo and batch rollback with a noted line', async () => {
    await invoice('a', { payee: 'Stadtwerke' });
    const saved = await saveCaptures(
      [
        { type: 'invoice', fields, amend: match },
        { type: 'todo', fields: { title: 'Müll runterbringen' } },
      ],
      'x',
      { states: ON },
    );
    expect((await invoiceRepo().get('a'))!.dunningLevel).toBe(1);
    await saved.undo();
    expect(await invoiceRepo().get('a')).toMatchObject({ amountMinor: 8430 });
    expect((await invoiceRepo().get('a'))!.dunningLevel).toBeUndefined();
    expect(await live('todos_task')).toHaveLength(0);

    await expect(
      saveCaptures(
        [
          { type: 'invoice', fields, amend: match },
          { type: 'todo', fields: { title: ' ' } },
        ],
        'x',
        { states: ON },
      ),
    ).rejects.toBeTruthy();
    const after = await invoiceRepo().get('a');
    expect(after).toBeTruthy();
    expect(after!.dunningLevel).toBeUndefined();
    expect(after!.note ?? '').toBe('');
  });
});

describe('council round 1 – edges of the contract', () => {
  it('reinstate brings back only what is deleted; its undo leaves a row it did not revive', async () => {
    const saved = await saveCapture('plan', { title: 'Steuer' }, { states: ON, id: 'p3' });
    // Only the plan row was deleted (the ToDo stays live).
    await db.table('planner_item').update('todos:p3', { deletedAt: 1 });
    void saved;
    const back = await reinstateCapture('plan', 'p3', { states: ON });
    expect((await live('planner_item')).map((x) => x.id)).toEqual(['todos:p3']);
    await back.undo();
    expect((await live('todos_task')).map((x) => x.id)).toEqual(['p3']);
    await expect(reinstateCapture('plan', 'nothing-here', { states: ON })).rejects.toMatchObject({
      code: 'invalid',
    });
  });

  it('a rollback leaves a tombstone under the id: saving again says so, reinstate is the way back', async () => {
    await expect(
      saveCaptures(
        [
          { type: 'todo', fields: { title: 'Antworten' }, id: 'r1' },
          { type: 'todo', fields: { title: ' ' } },
        ],
        'x',
        { states: ON },
      ),
    ).rejects.toBeTruthy();
    expect(
      (await saveCapture('todo', { title: 'Antworten' }, { states: ON, id: 'r1' })).existed,
    ).toBe('tombstone');
    await reinstateCapture('todo', 'r1', { states: ON });
    expect((await live('todos_task')).map((x) => x.id)).toEqual(['r1']);
  });

  it('amend undo removes exactly its line; the person’s blank lines and spaces stay', async () => {
    const own = 'Kundennummer 12\n\n  Zählerstand im Keller  ';
    await invoice('a', { payee: 'Stadtwerke', note: own });
    const saved = await amendCapture(
      'invoice',
      { title: 'Stadtwerke', amountMinor: 8740, dunning: { level: 1, date: TODAY } },
      { id: 'a', payee: 'Stadtwerke', dueDate: '2026-09-15', restMinor: 8430 },
      { states: ON },
    );
    await saved.undo();
    expect((await invoiceRepo().get('a'))!.note).toBe(own);
  });
});

describe('council round 2 – unsure stays a ToDo', () => {
  const opts = { today: TODAY, states: ON };
  it('the payee is known but the amount is outside the window: candidates, never a new invoice', async () => {
    await invoice('a', { payee: 'Stadtwerke' });
    expect(await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 99000 }, opts)).toEqual({
      candidates: [{ id: 'a', payee: 'Stadtwerke', dueDate: '2026-09-15', restMinor: 8430 }],
    });
  });
  it('a reminder that crossed with the payment: the paid invoice makes it a question', async () => {
    await invoice('a', { payee: 'Stadtwerke' });
    await invoiceRepo().update('a', { status: 'paid', paidAt: TODAY });
    expect(await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 8740 }, opts)).toEqual({
      candidates: [],
    });
  });
  it('nothing with that name at all: a new invoice may be made', async () => {
    await invoice('a', { payee: 'Telekom' });
    expect(await findOpenInvoice({ title: 'Stadtwerke', amountMinor: 8740 }, opts)).toBeUndefined();
  });
});

describe('council round 3', () => {
  it('a payee paid long ago is history: the reminder may become a new invoice', async () => {
    await invoice('a', { payee: 'Stadtwerke' });
    await invoiceRepo().update('a', { status: 'paid', paidAt: '2026-03-01' });
    expect(
      await findOpenInvoice(
        { title: 'Stadtwerke', amountMinor: 8740, dunning: { level: 1, date: TODAY } },
        { today: TODAY, states: ON },
      ),
    ).toBeUndefined();
  });

  it('reinstate never brings back half an entry (the plan row is missing)', async () => {
    const saved = await saveCapture('plan', { title: 'Steuer' }, { states: ON, id: 'p4' });
    await saved.undo();
    await db.table('planner_item').delete('todos:p4');
    await expect(reinstateCapture('plan', 'p4', { states: ON })).rejects.toMatchObject({
      code: 'invalid',
    });
    expect(await live('todos_task')).toHaveLength(0);
  });
});

describe('council round 4', () => {
  it('paid without a date counts as recent: unsure, never a new invoice', async () => {
    await invoice('a', { payee: 'Stadtwerke' });
    await db.table('invoices_invoice').update('a', { status: 'paid' });
    expect(
      await findOpenInvoice(
        { title: 'Stadtwerke', amountMinor: 8740 },
        { today: TODAY, states: ON },
      ),
    ).toEqual({ candidates: [] });
  });
});
