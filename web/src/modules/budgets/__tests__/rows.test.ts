import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { loadBudgetRows, loadHistory } from '../data';

/** Rows as another module stores them (written directly: modules never import each other). */
const row = (table: string, id: string, data: Record<string, unknown>) =>
  db
    .table(table)
    .put({ id, createdAt: 1, updatedAt: 1, deviceId: 'test', deletedAt: null, _f: {}, ...data });
const category = (id: string, name: string, parentId?: string) =>
  row('finance_category', id, { name, kind: 'expense', ...(parentId ? { parentId } : {}) });
const booking = (id: string, over: Record<string, unknown>) =>
  row('finance_transaction', id, { accountId: 'a', kind: 'expense', ...over });
const budget = (id: string, over: Record<string, unknown>) =>
  row('budgets_budget', id, { categoryId: 'food', monthlyLimitMinor: 30000, ...over });

beforeEach(async () => {
  for (const t of [
    'finance_account',
    'finance_category',
    'finance_transaction',
    'budgets_budget',
    '_settings',
  ])
    await db.table(t).clear();
  setNow(() => new Date(2026, 8, 15, 10, 0).getTime()); // 2026-09-15: day 15 of 30, third quarter
  await row('finance_account', 'a', { name: 'Giro', openingBalanceMinor: 0, order: 0 });
  await category('food', 'Essen');
  await category('super', 'Supermarkt', 'food');
  await category('home', 'Wohnen');
});
afterEach(() => setNow());

describe('budget rows', () => {
  it('leaves the rows empty while finance is off, lists the categories when there is no budget yet', async () => {
    await budget('b1', {});
    expect((await loadBudgetRows('2026-09', '2026-09-15', false)).rows).toEqual([]);
    await db.table('budgets_budget').clear();
    const none = await loadBudgetRows('2026-09', '2026-09-15', true);
    expect(none.rows).toEqual([]);
    expect(none.categories.map((c) => c.id).sort()).toEqual(['food', 'home', 'super']);
  });

  it('counts the children of a category and nothing from other months or kinds', async () => {
    await budget('b1', {});
    await booking('t1', { categoryId: 'food', amountMinor: 1000, date: '2026-09-02' });
    await booking('t2', { categoryId: 'super', amountMinor: 2500, date: '2026-09-10' });
    await booking('t3', { categoryId: 'home', amountMinor: 9999, date: '2026-09-10' });
    await booking('t4', { categoryId: 'food', amountMinor: 7777, date: '2026-08-31' });
    await booking('t5', {
      categoryId: 'food',
      kind: 'income',
      amountMinor: 5555,
      date: '2026-09-03',
    });
    const [r] = (await loadBudgetRows('2026-09', '2026-09-15', true)).rows;
    expect(r!.spent).toBe(3500);
    expect(r!.limit).toBe(30000);
    expect(r!.status.tone).toBe('ok');
  });

  it('sums a quarter and names its months', async () => {
    await budget('q', { period: 'quarter', monthlyLimitMinor: 90000 });
    await booking('t1', { categoryId: 'food', amountMinor: 1000, date: '2026-07-01' });
    await booking('t2', { categoryId: 'food', amountMinor: 2000, date: '2026-08-31' });
    await booking('t3', { categoryId: 'food', amountMinor: 4000, date: '2026-09-30' });
    await booking('t4', { categoryId: 'food', amountMinor: 8000, date: '2026-06-30' });
    const [r] = (await loadBudgetRows('2026-08', '2026-09-15', true)).rows;
    expect(r!.spent).toBe(7000);
    expect(r!.info.months).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(r!.running).toBe(true);
  });

  it('carries what was left (or overspent) of the previous period into the limit', async () => {
    await budget('m', { carryOver: true });
    await booking('t1', { categoryId: 'food', amountMinor: 20000, date: '2026-08-10' });
    expect((await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]).toMatchObject({
      carry: 10000,
      limit: 40000,
    });
    await booking('t2', { categoryId: 'food', amountMinor: 25000, date: '2026-08-11' });
    expect((await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]).toMatchObject({
      carry: -15000,
      limit: 15000,
    });
  });

  it('applies its own warning level before the default', async () => {
    await budget('w', { warnAtPercent: 50 });
    await booking('t1', { categoryId: 'food', amountMinor: 15000, date: '2026-09-02' });
    expect((await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]!.status.tone).toBe('warn');
    await db.table('budgets_budget').clear();
    await budget('w2', {});
    expect((await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]!.status.tone).toBe('ok');
  });

  it('forecasts the running period from the pace and from planned repeating bookings', async () => {
    await budget('f', { monthlyLimitMinor: 30000 });
    await booking('t1', { categoryId: 'food', amountMinor: 20000, date: '2026-09-05' });
    // Day 15 of 30: 20.000 so far → 40.000 at this pace.
    expect((await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]!.projected).toBe(40000);
    // A repeating expense of this category (head on 2026-08-20 → next 2026-09-20, not booked yet): known, not guessed.
    await booking('rep', {
      categoryId: 'food',
      amountMinor: 30000,
      date: '2026-08-20',
      repeat: 'monthly',
    });
    expect((await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]!.projected).toBe(50000);
  });

  it('has no forecast for a past month and none when the setting is off', async () => {
    await budget('f', {});
    await booking('t1', { categoryId: 'food', amountMinor: 20000, date: '2026-08-05' });
    expect(
      (await loadBudgetRows('2026-08', '2026-09-15', true)).rows[0]!.projected,
    ).toBeUndefined();
    await row('_settings', 'module.budgets', { warnAtPercent: 80, showForecast: false });
    expect(
      (await loadBudgetRows('2026-09', '2026-09-15', true)).rows[0]!.projected,
    ).toBeUndefined();
  });
});

describe('history', () => {
  it('lists six periods oldest first with what each spent', async () => {
    await booking('t1', { categoryId: 'food', amountMinor: 1000, date: '2026-09-02' });
    await booking('t2', { categoryId: 'super', amountMinor: 500, date: '2026-07-02' });
    const cats = [
      { id: 'food', name: 'Essen' },
      { id: 'super', name: 'Supermarkt', parentId: 'food' },
    ];
    const h = await loadHistory({ categoryId: 'food' }, '2026-09', cats);
    expect(h.map((x) => x.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(h.map((x) => x.spent)).toEqual([0, 0, 0, 500, 0, 1000]);
    const q = await loadHistory({ categoryId: 'food', period: 'quarter' }, '2026-09', cats, 2);
    expect(q.map((x) => x.spent)).toEqual([0, 1500]);
  });
});
