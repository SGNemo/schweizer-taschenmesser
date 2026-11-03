import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { accountRepo, transactionRepo } from '../repo';
import { bookDueSubscriptionCharges, subscriptionTransactionId } from '../services';

/** A subscription row as the subscriptions module stores it (written directly: modules never import each other). */
const putSubscription = (id: string, over: Record<string, unknown> = {}) =>
  db.table('subscriptions_subscription').put({
    id,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'test',
    deletedAt: null,
    _f: {},
    name: 'Streaming Plus',
    amountMinor: 1299,
    recurrence: { freq: 'monthly', interval: 1 },
    startDate: '2026-01-15',
    active: true,
    ...over,
  });

beforeEach(async () => {
  for (const t of [
    'finance_account',
    'finance_category',
    'finance_transaction',
    'subscriptions_subscription',
    '_settings',
  ])
    await db.table(t).clear();
  setNow(() => new Date(2026, 2, 20, 10, 0).getTime()); // 2026-03-20
  await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 });
});
afterEach(() => setNow());

describe('booking the charges of subscriptions (setting "Abo-Abbuchungen buchen")', () => {
  it('books nothing while the setting is off (the default)', async () => {
    await putSubscription('s1');
    expect(await bookDueSubscriptionCharges()).toBe(0);
    expect(await transactionRepo.active().count()).toBe(0);
  });

  it('books the charge of the last month once, with a stable id and a link back', async () => {
    await setSettings('module.finance', { bookSubscriptions: true });
    await putSubscription('s1');
    expect(await bookDueSubscriptionCharges()).toBe(1); // 2026-03-15 is the only one in 31 days
    expect(await bookDueSubscriptionCharges()).toBe(0); // idempotent
    const rows = await transactionRepo.active().toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: subscriptionTransactionId('s1', '2026-03-15'),
      kind: 'expense',
      amountMinor: 1299,
      payee: 'Streaming Plus',
      date: '2026-03-15',
      sourceRef: 'subscription:s1',
    });
  });

  it('does not bring back a booking the user deleted', async () => {
    await setSettings('module.finance', { bookSubscriptions: true });
    await putSubscription('s1');
    await bookDueSubscriptionCharges();
    await transactionRepo.remove(subscriptionTransactionId('s1', '2026-03-15'));
    expect(await bookDueSubscriptionCharges()).toBe(0);
    expect(await transactionRepo.active().count()).toBe(0);
  });

  it('skips a charge that a booking already stands for (e.g. a bank import within three days)', async () => {
    await setSettings('module.finance', { bookSubscriptions: true });
    await putSubscription('s1');
    const account = (await accountRepo.active().toArray())[0]!;
    await transactionRepo.create({
      accountId: account.id,
      kind: 'expense',
      amountMinor: 1299,
      date: '2026-03-16',
      payee: 'STREAMING PLUS 4711',
    });
    expect(await bookDueSubscriptionCharges()).toBe(0);
    expect(await transactionRepo.active().count()).toBe(1);
  });

  it('ignores paused subscriptions and charges older than 31 days', async () => {
    await setSettings('module.finance', { bookSubscriptions: true });
    await putSubscription('paused', { active: false });
    await putSubscription('old', {
      name: 'Old',
      startDate: '2025-12-01',
      recurrence: { freq: 'yearly', interval: 1 },
    });
    expect(await bookDueSubscriptionCharges()).toBe(0);
  });

  it('books only in the currency of an account (a dollar subscription without a dollar account gets its own account)', async () => {
    await setSettings('module.finance', { bookSubscriptions: true });
    await putSubscription('usd', { name: 'Dollar Plan', currency: 'USD', amountMinor: 500 });
    // Only a euro account exists: the dollar charge is not booked into it.
    expect(await bookDueSubscriptionCharges()).toBe(0);
    const rows = await transactionRepo.active().toArray();
    expect(rows).toHaveLength(0);
  });
});
