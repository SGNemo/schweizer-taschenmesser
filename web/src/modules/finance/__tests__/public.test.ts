import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { expensesByCategory, listExpenseCategories } from '../public';
import { accountRepo, categoryRepo, transactionRepo } from '../repo';

beforeEach(async () => {
  for (const t of ['finance_account', 'finance_category', 'finance_transaction'])
    await db.table(t).clear();
});

describe('finance public read API', () => {
  it('lists expense categories by name and sums a month per category', async () => {
    await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 }, { id: 'a' });
    await categoryRepo.create({ name: 'Wohnen', kind: 'expense' }, { id: 'home' });
    await categoryRepo.create({ name: 'Essen', kind: 'expense' }, { id: 'food' });
    await categoryRepo.create({ name: 'Gehalt', kind: 'income' }, { id: 'salary' });
    const tx = (over: Record<string, unknown>) =>
      transactionRepo.create({
        accountId: 'a',
        kind: 'expense',
        amountMinor: 100,
        date: '2026-09-10',
        ...over,
      } as never);
    await tx({ categoryId: 'food', amountMinor: 1200 });
    await tx({ categoryId: 'food', amountMinor: 800, date: '2026-09-30' });
    await tx({ categoryId: 'home', amountMinor: 50000 });
    await tx({ amountMinor: 300 }); // uncategorised
    await tx({ categoryId: 'food', amountMinor: 999, date: '2026-10-01' }); // other month
    await tx({ kind: 'income', categoryId: 'salary', amountMinor: 250000 });

    expect((await listExpenseCategories()).map((c) => c.name)).toEqual(['Essen', 'Wohnen']);
    const sums = await expensesByCategory('2026-09');
    expect(Object.fromEntries(sums)).toEqual({ food: 2000, home: 50000, '': 300 });
  });
});
