import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setSettings } from '@/core/settings/settings';
import { accountRepo, transactionRepo } from '../repo';
import start, { bookDueRepeats, coveredByRepeatingBooking } from '../services';

const paid = {
  invoiceId: 'i1',
  payee: 'Hausverwaltung Mustermann',
  amountMinor: 65000,
  paidAt: '2026-10-02',
};

beforeEach(async () => {
  bus.clear();
  for (const t of ['finance_account', 'finance_category', 'finance_transaction', '_settings']) {
    await db.table(t).clear();
  }
});

describe('a paid invoice becomes a booking', () => {
  it('books once, even when paid twice (the id belongs to the invoice)', async () => {
    const stop = start();
    await bus.emit('invoice.paid', paid);
    await bus.emit('invoice.paid', paid);
    stop();
    expect(await transactionRepo.active().count()).toBe(1);
  });

  it('books nothing when the user switched it off in the invoice settings', async () => {
    await setSettings('module.invoices', { bookWhenPaid: false });
    const stop = start();
    await bus.emit('invoice.paid', paid);
    stop();
    expect(await transactionRepo.active().count()).toBe(0);
  });

  it('books nothing when the Finance module is off (its service is not running)', async () => {
    await bus.emit('invoice.paid', paid);
    expect(await transactionRepo.active().count()).toBe(0);
  });
});

describe('no double booking with a repeating booking', () => {
  async function rent(over: Record<string, unknown> = {}) {
    const account = await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
    await transactionRepo.create({
      accountId: account.id,
      kind: 'expense',
      amountMinor: 65000,
      date: '2026-09-02',
      payee: 'Hausverwaltung  mustermann',
      repeat: 'monthly',
      ...over,
    });
  }

  it('skips the booking when a repeating one has the same payee and amount', async () => {
    await rent();
    expect(await coveredByRepeatingBooking(paid)).toBe(true);
    const stop = start();
    await bus.emit('invoice.paid', paid);
    stop();
    expect(await transactionRepo.active().count()).toBe(1); // only the rent itself
  });

  it('books when the amount or payee differ, or the booking does not repeat', async () => {
    await rent({ amountMinor: 70000 });
    expect(await coveredByRepeatingBooking(paid)).toBe(false);
    await db.table('finance_transaction').clear();
    await rent({ payee: 'Stadtwerke' });
    expect(await coveredByRepeatingBooking(paid)).toBe(false);
    await db.table('finance_transaction').clear();
    await rent({ repeat: undefined });
    expect(await coveredByRepeatingBooking(paid)).toBe(false);
  });

  it('a booked invoice does not turn into a second booking when the repeats run', async () => {
    const stop = start();
    await bus.emit('invoice.paid', paid);
    stop();
    await bookDueRepeats();
    expect(await transactionRepo.active().count()).toBe(1);
  });
});
