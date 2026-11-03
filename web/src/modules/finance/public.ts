/**
 * Read-only API for modules that are allowed to look at finance data (budgets).
 * Everything else must use the event bus or manifest contributions.
 */
import { compareText } from '@/core/i18n/format';
import { monthOf } from '@/core/time/dates';
import { currencyOf, DEFAULT_CURRENCY } from '@/core/money';
import { accountRepo, categoryRepo, transactionRepo } from './repo';
import { categoryParts, isTransfer, nextRepeatDate } from './logic';

export interface ExpenseCategory {
  id: string;
  name: string;
  /** Parent category (one level); budgets for the parent include its children. */
  parentId?: string;
}

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return (await categoryRepo.active().toArray())
    .filter((c) => c.kind === 'expense')
    .map(({ id, name, parentId }) => ({ id, name, ...(parentId ? { parentId } : {}) }))
    .sort((a, b) => compareText(a.name, b.name));
}

/**
 * Expenses (cents) of a month ('YYYY-MM') per category id; uncategorised bookings use the key ''.
 * Only accounts in `currency` (default euro) count: nothing is converted.
 */
export async function expensesByCategory(
  month: string,
  currency: string = DEFAULT_CURRENCY,
): Promise<Map<string, number>> {
  const sums = new Map<string, number>();
  const accountIds = new Set(
    (await accountRepo.active().toArray())
      .filter((a) => currencyOf(a) === currency)
      .map((a) => a.id),
  );
  for (const tx of await transactionRepo.active().toArray()) {
    if (
      tx.kind !== 'expense' ||
      isTransfer(tx) ||
      monthOf(tx.date) !== month ||
      !accountIds.has(tx.accountId)
    )
      continue;
    // A split booking counts per part; transfers between own accounts are no expense.
    for (const part of categoryParts(tx)) {
      const key = part.categoryId ?? '';
      sums.set(key, (sums.get(key) ?? 0) + part.amountMinor);
    }
  }
  return sums;
}

/**
 * Expenses (cents) per category id that are already planned between `from` and `to` (inclusive)
 * by repeating bookings that have not been booked yet. Budgets add them to the spending so far
 * for the forecast to the end of the period. Uncategorised ones use the key ''.
 */
export async function plannedExpensesByCategory(
  from: string,
  to: string,
  currency: string = DEFAULT_CURRENCY,
): Promise<Map<string, number>> {
  const sums = new Map<string, number>();
  const accountIds = new Set(
    (await accountRepo.active().toArray())
      .filter((a) => currencyOf(a) === currency)
      .map((a) => a.id),
  );
  for (const head of await transactionRepo.active().toArray()) {
    if (!head.repeat || head.kind !== 'expense' || !accountIds.has(head.accountId)) continue;
    let date = head.date;
    for (let i = 0; i < 60; i++) {
      date = nextRepeatDate(date, head.repeat);
      if (date > to) break;
      if (date < from) continue;
      for (const part of categoryParts(head)) {
        const key = part.categoryId ?? '';
        sums.set(key, (sums.get(key) ?? 0) + part.amountMinor);
      }
    }
  }
  return sums;
}
