/**
 * Read-only API for modules that are allowed to look at finance data (budgets).
 * Everything else must use the event bus or manifest contributions.
 */
import { compareText } from '@/core/i18n/format';
import { monthOf } from '@/core/time/dates';
import { categoryRepo, transactionRepo } from './repo';

export interface ExpenseCategory {
  id: string;
  name: string;
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return (await categoryRepo.active().toArray())
    .filter((c) => c.kind === 'expense')
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => compareText(a.name, b.name));
}

/** Expenses (cents) of a month ('YYYY-MM') per category id; uncategorised bookings use the key ''. */
export async function expensesByCategory(month: string): Promise<Map<string, number>> {
  const sums = new Map<string, number>();
  for (const tx of await transactionRepo.active().toArray()) {
    if (tx.kind !== 'expense' || monthOf(tx.date) !== month) continue;
    const key = tx.categoryId ?? '';
    sums.set(key, (sums.get(key) ?? 0) + tx.amountMinor);
  }
  return sums;
}
