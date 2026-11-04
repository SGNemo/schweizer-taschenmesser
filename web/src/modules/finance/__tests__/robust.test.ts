import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { accountRepo, transactionRepo } from '../repo';
import { bookDueRepeats, invoiceTransactionId, repairInvoiceBookings } from '../services';

beforeEach(async () => {
  bus.clear();
  setNow(() => new Date(2026, 10, 4, 10, 0).getTime());
  for (const t of [
    'finance_account',
    'finance_category',
    'finance_transaction',
    'invoices_invoice',
    '_settings',
    '_outbox',
  ])
    await db.table(t).clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  setNow();
});

// Invoices are stored rows here (a module's tests do not import another module's repo).
let invoiceNo = 0;
const paidInvoice = async (over: Record<string, unknown> = {}) => {
  const row = {
    id: `inv${++invoiceNo}`,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'd',
    deletedAt: null,
    _f: {},
    payee: 'Stadtwerke',
    amountMinor: 8990,
    dueDate: '2026-10-05',
    status: 'paid',
    paidAt: '2026-10-04',
    ...over,
  };
  await db.table('invoices_invoice').put(row);
  return row;
};

describe('repairInvoiceBookings: what a lost event left unbooked', () => {
  it('books a paid invoice without a booking, once, however often it runs', async () => {
    const invoice = await paidInvoice();
    expect(await repairInvoiceBookings()).toBe(1);
    expect(await repairInvoiceBookings()).toBe(0);
    const bookings = await transactionRepo.active().toArray();
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({
      id: invoiceTransactionId(invoice.id),
      amountMinor: 8990,
      date: '2026-10-04',
      payee: 'Stadtwerke',
    });
  });

  it('books a part payment under its own id and the rest of a paid invoice next to it', async () => {
    const invoice = await paidInvoice({
      amountMinor: 10000,
      payments: [{ id: 'p1', date: '2026-09-20', amountMinor: 4000 }],
    });
    expect(await repairInvoiceBookings()).toBe(2);
    const ids = (await transactionRepo.active().toArray()).map((t) => t.id).sort();
    expect(ids).toEqual(
      [invoiceTransactionId(invoice.id), invoiceTransactionId(invoice.id, 'p1')].sort(),
    );
    const rest = await transactionRepo.get(invoiceTransactionId(invoice.id));
    expect(rest?.amountMinor).toBe(6000);
  });

  it('leaves a booking the user deleted deleted, and one that exists as the user changed it', async () => {
    const invoice = await paidInvoice();
    await repairInvoiceBookings();
    const id = invoiceTransactionId(invoice.id);
    await transactionRepo.update(id, { amountMinor: 1 });
    await repairInvoiceBookings();
    expect((await transactionRepo.get(id))?.amountMinor).toBe(1);
    await transactionRepo.remove(id);
    expect(await repairInvoiceBookings()).toBe(0);
    expect(await transactionRepo.get(id)).toBeUndefined();
  });

  it('books nothing when the invoice setting "book when paid" is off', async () => {
    await paidInvoice();
    await setSettings('module.invoices', { bookWhenPaid: false });
    expect(await repairInvoiceBookings()).toBe(0);
    expect(await transactionRepo.active().count()).toBe(0);
  });

  it('skips the rest of an invoice that a repeating booking with the same payee and amount covers', async () => {
    const account = await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
    await transactionRepo.create({
      accountId: account.id,
      kind: 'expense',
      amountMinor: 8990,
      date: '2026-09-02',
      payee: 'Stadtwerke',
      repeat: 'monthly',
    });
    await paidInvoice();
    expect(await repairInvoiceBookings()).toBe(0);
  });
});

describe('bookDueRepeats: all or nothing', () => {
  it('a failure half way leaves the repeat in place and books nothing', async () => {
    const account = await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
    const head = await transactionRepo.create({
      accountId: account.id,
      kind: 'expense',
      amountMinor: 65000,
      date: '2026-09-02',
      payee: 'Miete',
      repeat: 'monthly',
    });
    const create = transactionRepo.create.bind(transactionRepo);
    let calls = 0;
    vi.spyOn(transactionRepo, 'create').mockImplementation(async (data, opts) => {
      if (++calls === 2) throw new Error('crash');
      return create(data, opts);
    });
    await expect(bookDueRepeats()).rejects.toThrow('crash');
    vi.restoreAllMocks();

    const rows = await transactionRepo.active().toArray();
    expect(rows).toHaveLength(1); // the first new entry was taken back with the failed transaction
    expect(rows[0]!.id).toBe(head.id);
    expect(rows[0]!.repeat).toBe('monthly'); // and the repeat did not move on
    // The next run books them all.
    expect(await bookDueRepeats()).toBeGreaterThan(1);
  });
});
