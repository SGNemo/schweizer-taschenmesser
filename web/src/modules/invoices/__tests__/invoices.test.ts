import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { toEpoch } from '@/core/time/dates';
import { markOpen, markPaid, saveInvoice } from '../actions';
import { openTotal, sortInvoices } from '../logic';
import manifest from '../manifest';
import { listOpenInvoices, sumOpenInvoices } from '../public';
import { invoiceRepo } from '../repo';
import { invoiceSchema } from '../schema';

const inv = (over: Record<string, unknown> = {}) =>
  invoiceSchema.parse({ payee: 'Stadtwerke', amountMinor: 8990, dueDate: '2026-10-05', ...over });

beforeEach(async () => {
  bus.clear();
  await db.table('invoices_invoice').clear();
  await db.table('_settings').clear();
});

describe('invoices module', () => {
  it('validates data', () => {
    expect(
      invoiceSchema.safeParse({ payee: '', amountMinor: 1, dueDate: '2026-01-01' }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({ payee: 'x', amountMinor: 0, dueDate: '2026-01-01' }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({ payee: 'x', amountMinor: 1.5, dueDate: '2026-01-01' }).success,
    ).toBe(false);
    expect(inv().status).toBe('open');
  });

  it('sorts open by due date, paid after them by payment date (newest first)', () => {
    const c = (id: string, over: Record<string, unknown>) => ({ ...inv(over), id, createdAt: 1 });
    const list = sortInvoices([
      c('paid-old', { status: 'paid', paidAt: '2026-01-01' }),
      c('late', { dueDate: '2026-12-01' }),
      c('paid-new', { status: 'paid', paidAt: '2026-06-01' }),
      c('soon', { dueDate: '2026-10-01' }),
    ]);
    expect(list.map((x) => x.id)).toEqual(['soon', 'late', 'paid-new', 'paid-old']);
    expect(openTotal(list)).toBe(2 * 8990);
  });

  it('markPaid announces the payment on the bus; markOpen announces the reopening', async () => {
    const paid = vi.fn();
    const unpaid = vi.fn();
    bus.on('invoice.paid', paid);
    bus.on('invoice.unpaid', unpaid);
    const i = await invoiceRepo.create(inv({ note: 'Strom' }));

    await markPaid(i.id, '2026-10-02');
    expect(paid).toHaveBeenCalledWith({
      invoiceId: i.id,
      payee: 'Stadtwerke',
      amountMinor: 8990,
      paidAt: '2026-10-02',
      note: 'Strom',
    });
    expect((await invoiceRepo.get(i.id))?.status).toBe('paid');

    await markOpen(i.id);
    expect(unpaid).toHaveBeenCalledWith({ invoiceId: i.id });
    const reopened = await invoiceRepo.get(i.id);
    expect(reopened?.status).toBe('open');
    expect(reopened?.paidAt).toBeUndefined();
  });

  it('saving edits of a paid invoice re-announces it, editing an open one does not', async () => {
    const paid = vi.fn();
    bus.on('invoice.paid', paid);
    const open = await invoiceRepo.create(inv());
    await saveInvoice(open.id, inv({ amountMinor: 100 }));
    expect(paid).not.toHaveBeenCalled();

    const p = await invoiceRepo.create(inv({ status: 'paid', paidAt: '2026-10-01' }));
    await saveInvoice(p.id, inv({ status: 'paid', paidAt: '2026-10-01', amountMinor: 555 }));
    expect(paid).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: p.id, amountMinor: 555 }),
    );
  });

  it('public API lists only live open invoices in due order', async () => {
    await invoiceRepo.create(inv({ payee: 'B', dueDate: '2026-11-01', amountMinor: 200 }));
    await invoiceRepo.create(inv({ payee: 'A', dueDate: '2026-10-01', amountMinor: 100 }));
    await invoiceRepo.create(inv({ payee: 'Paid', status: 'paid', paidAt: '2026-09-01' }));
    const gone = await invoiceRepo.create(inv({ payee: 'Gone' }));
    await invoiceRepo.remove(gone.id);
    expect((await listOpenInvoices()).map((i) => i.payee)).toEqual(['A', 'B']);
    expect(await sumOpenInvoices()).toBe(300);
  });

  it('shows open invoices on the calendar at their due date', async () => {
    await invoiceRepo.create(inv({ dueDate: '2026-10-05' }));
    await invoiceRepo.create(
      inv({ payee: 'Bezahlt', status: 'paid', paidAt: '2026-10-01', dueDate: '2026-10-06' }),
    );
    const items = await collectCalendarItems({ from: '2026-10-01', to: '2026-10-31' }, [manifest]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'invoice', date: '2026-10-05', allDay: true });
    expect(items[0]!.title.replace(/\s/g, ' ')).toBe('Stadtwerke · 89,90 €');
  });

  it('reminds two days before the due date at 09:00 by default', async () => {
    await invoiceRepo.create(inv({ dueDate: '2026-10-05' }));
    const at = toEpoch('2026-10-03', '09:00');
    const due = await collectNotifications({ from: at - 60_000, to: at }, [manifest]);
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ at, title: 'Rechnung fällig: Stadtwerke', url: '/invoices' });
    expect(await collectNotifications({ from: at, to: at + 3_600_000 }, [manifest])).toEqual([]);
  });
});
