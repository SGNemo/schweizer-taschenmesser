import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { createServiceManager } from '@/core/modules/services';
import manifest from '../manifest';
import {
  accountRepo,
  categoryRepo,
  DEFAULT_ACCOUNT_ID,
  deleteAccount,
  ensureDefaults,
  INVOICE_CATEGORY_ID,
  primaryAccountId,
  transactionRepo,
} from '../repo';
import { accountSchema, categorySchema, transactionSchema } from '../schema';
import start, { bookInvoiceExpense, invoiceTransactionId, removeInvoiceExpense } from '../services';

const paid = {
  invoiceId: 'i1',
  payee: 'Stadtwerke',
  amountMinor: 8990,
  paidAt: '2026-10-02',
  note: 'Strom',
};

beforeEach(async () => {
  bus.clear();
  for (const t of ['finance_account', 'finance_category', 'finance_transaction', '_settings']) {
    await db.table(t).clear();
  }
});

describe('finance module', () => {
  it('validates data', () => {
    expect(accountSchema.parse({ name: 'K' }).openingBalanceMinor).toBe(0);
    expect(accountSchema.safeParse({ name: 'K', openingBalanceMinor: -500 }).success).toBe(true);
    expect(categorySchema.safeParse({ name: 'x', kind: 'other' }).success).toBe(false);
    const tx = { accountId: 'a', kind: 'expense', amountMinor: 100, date: '2026-01-01' };
    expect(transactionSchema.safeParse(tx).success).toBe(true);
    expect(transactionSchema.safeParse({ ...tx, amountMinor: -5 }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...tx, date: '1.1.2026' }).success).toBe(false);
  });

  it('seeds defaults once and never again after the user removed them', async () => {
    await ensureDefaults();
    await ensureDefaults();
    expect(await accountRepo.active().count()).toBe(1);
    expect(await categoryRepo.active().count()).toBe(10);

    await categoryRepo.removeMany((await categoryRepo.active().primaryKeys()) as string[]);
    await ensureDefaults();
    expect(await categoryRepo.active().count()).toBe(0);
  });

  it('primaryAccountId picks the first account and revives/creates the default when none is left', async () => {
    await accountRepo.create({ name: 'B', openingBalanceMinor: 0, order: 2 });
    const a = await accountRepo.create({ name: 'A', openingBalanceMinor: 0, order: 1 });
    expect(await primaryAccountId()).toBe(a.id);

    await accountRepo.removeMany([a.id]);
    await accountRepo.removeMany((await accountRepo.active().primaryKeys()) as string[]);
    const id = await primaryAccountId();
    expect(id).toBe(DEFAULT_ACCOUNT_ID);
    expect((await accountRepo.get(DEFAULT_ACCOUNT_ID))?.name).toBe('Girokonto');
  });

  it('deleteAccount removes its transactions too', async () => {
    const a = await accountRepo.create({ name: 'A', openingBalanceMinor: 0, order: 0 });
    const other = await accountRepo.create({ name: 'B', openingBalanceMinor: 0, order: 1 });
    await transactionRepo.create({
      accountId: a.id,
      kind: 'expense',
      amountMinor: 100,
      date: '2026-01-01',
    });
    const keep = await transactionRepo.create({
      accountId: other.id,
      kind: 'expense',
      amountMinor: 200,
      date: '2026-01-01',
    });
    await deleteAccount(a.id);
    expect((await transactionRepo.active().toArray()).map((t) => t.id)).toEqual([keep.id]);
    expect(await accountRepo.get(a.id)).toBeUndefined();
  });
});

describe('invoice → expense (event bus integration)', () => {
  it('books one expense per paid invoice, idempotently, into the first account', async () => {
    const stop = start();
    await bus.emit('invoice.paid', paid);
    await bus.emit('invoice.paid', paid);
    stop();

    const txs = await transactionRepo.active().toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      id: invoiceTransactionId('i1'),
      kind: 'expense',
      amountMinor: 8990,
      date: '2026-10-02',
      payee: 'Stadtwerke',
      note: 'Strom',
      sourceRef: 'invoice:i1',
      categoryId: INVOICE_CATEGORY_ID,
      accountId: DEFAULT_ACCOUNT_ID,
    });
  });

  it('re-announcing after an edit updates amount/date but keeps the account and category the user chose', async () => {
    await bookInvoiceExpense(paid);
    const other = await accountRepo.create({
      name: 'Zweitkonto',
      openingBalanceMinor: 0,
      order: 5,
    });
    await transactionRepo.update(invoiceTransactionId('i1'), {
      accountId: other.id,
      categoryId: 'cat-home',
    });
    await bookInvoiceExpense({ ...paid, amountMinor: 9500, paidAt: '2026-10-03' });
    const tx = await transactionRepo.get(invoiceTransactionId('i1'));
    expect(tx).toMatchObject({
      amountMinor: 9500,
      date: '2026-10-03',
      accountId: other.id,
      categoryId: 'cat-home',
    });
    expect(await transactionRepo.active().count()).toBe(1);
  });

  it('removes the expense when the invoice is reopened and brings it back when paid again', async () => {
    const stop = start();
    await bus.emit('invoice.paid', paid);
    await bus.emit('invoice.unpaid', { invoiceId: 'i1' });
    expect(await transactionRepo.active().count()).toBe(0);
    await removeInvoiceExpense('unknown'); // no-op
    await bus.emit('invoice.paid', paid);
    stop();
    expect(await transactionRepo.active().count()).toBe(1);
  });

  it('only reacts while the module service is running (module enabled)', async () => {
    const m = createServiceManager([manifest]);
    await m.update({ finance: false });
    await bus.emit('invoice.paid', paid);
    expect(await transactionRepo.active().count()).toBe(0);

    await m.update({ finance: true });
    await bus.emit('invoice.paid', paid);
    expect(await transactionRepo.active().count()).toBe(1);

    await m.update({ finance: false });
    await bus.emit('invoice.paid', { ...paid, invoiceId: 'i2' });
    expect(await transactionRepo.active().count()).toBe(1);
  });

  it('a failing booking does not break the emitter', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const stop = start();
    await expect(bus.emit('invoice.paid', { ...paid, amountMinor: 0 })).resolves.toBeUndefined();
    stop();
    err.mockRestore();
  });
});
