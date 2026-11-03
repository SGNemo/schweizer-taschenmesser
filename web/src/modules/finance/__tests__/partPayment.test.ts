import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setSettings } from '@/core/settings/settings';
import { transactionRepo } from '../repo';
import start, { invoiceTransactionId } from '../services';

const payment = {
  invoiceId: 'i1',
  paymentId: 'p1',
  payee: 'Stadtwerke',
  amountMinor: 4000,
  date: '2026-10-02',
};
const paid = { invoiceId: 'i1', payee: 'Stadtwerke', amountMinor: 6000, paidAt: '2026-10-05' };

beforeEach(async () => {
  bus.clear();
  for (const t of ['finance_account', 'finance_category', 'finance_transaction', '_settings'])
    await db.table(t).clear();
});

describe('part payments of an invoice become bookings', () => {
  it('books each part on its own id, then the rest on the invoice id (sum = amount)', async () => {
    const stop = start();
    await bus.emit('invoice.payment', payment);
    await bus.emit('invoice.paid', paid);
    stop();
    const all = await transactionRepo.active().toArray();
    expect(all.map((t) => t.id).sort()).toEqual(
      [invoiceTransactionId('i1', 'p1'), invoiceTransactionId('i1')].sort(),
    );
    expect(all.reduce((s, t) => s + t.amountMinor, 0)).toBe(10000);
    expect(all.find((t) => t.id === invoiceTransactionId('i1', 'p1'))!.date).toBe('2026-10-02');
  });

  it('is idempotent: the same payment twice is one booking', async () => {
    const stop = start();
    await bus.emit('invoice.payment', payment);
    await bus.emit('invoice.payment', payment);
    stop();
    expect(await transactionRepo.active().count()).toBe(1);
  });

  it('a removed part removes its booking only', async () => {
    const stop = start();
    await bus.emit('invoice.payment', payment);
    await bus.emit('invoice.payment', { ...payment, paymentId: 'p2', amountMinor: 1000 });
    await bus.emit('invoice.paymentRemoved', { invoiceId: 'i1', paymentId: 'p1' });
    stop();
    const all = await transactionRepo.active().toArray();
    expect(all.map((t) => t.id)).toEqual([invoiceTransactionId('i1', 'p2')]);
  });

  it('parts that covered everything book no rest and drop an earlier rest booking', async () => {
    const stop = start();
    await bus.emit('invoice.paid', paid);
    expect(await transactionRepo.active().count()).toBe(1);
    await bus.emit('invoice.paid', { ...paid, amountMinor: 0 });
    stop();
    expect(await transactionRepo.active().count()).toBe(0);
  });

  it('respects the invoice setting "book when paid"', async () => {
    await setSettings('module.invoices', { bookWhenPaid: false });
    const stop = start();
    await bus.emit('invoice.payment', payment);
    stop();
    expect(await transactionRepo.active().count()).toBe(0);
  });
});
