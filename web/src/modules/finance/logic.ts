import { compareText } from '@/core/i18n/format';
import { addMonthsToMonth, formatDay, monthOf } from '@/core/time/dates';
import type { Account, Transaction } from './schema';

type Tx = Pick<Transaction, 'accountId' | 'categoryId' | 'kind' | 'amountMinor' | 'date'>;

export const signed = (t: Pick<Tx, 'kind' | 'amountMinor'>): number =>
  t.kind === 'income' ? t.amountMinor : -t.amountMinor;

/** Opening balance plus every booking up to and including `asOf` ('YYYY-MM-DD'). */
export function accountBalance(
  account: Pick<Account, 'openingBalanceMinor'>,
  txs: Tx[],
  asOf: string,
): number {
  return txs.reduce(
    (sum, t) => (t.date <= asOf ? sum + signed(t) : sum),
    account.openingBalanceMinor,
  );
}

export function balances<A extends Pick<Account, 'openingBalanceMinor'> & { id: string }>(
  accounts: A[],
  txs: Tx[],
  asOf: string,
): Map<string, number> {
  const byAccount = new Map<string, Tx[]>();
  for (const t of txs) byAccount.set(t.accountId, [...(byAccount.get(t.accountId) ?? []), t]);
  return new Map(accounts.map((a) => [a.id, accountBalance(a, byAccount.get(a.id) ?? [], asOf)]));
}

export interface MonthSummary {
  income: number;
  expense: number;
  net: number;
}

export function monthSummary(txs: Tx[], month: string): MonthSummary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (monthOf(t.date) !== month) continue;
    if (t.kind === 'income') income += t.amountMinor;
    else expense += t.amountMinor;
  }
  return { income, expense, net: income - expense };
}

export interface CategoryTotal {
  /** undefined for uncategorised bookings and the folded tail. */
  categoryId?: string;
  name: string;
  amountMinor: number;
}

export const UNCATEGORISED = 'Ohne Kategorie';
export const OTHERS = 'Weitere';

/** Expenses of a month per category, largest first; everything beyond `limit` is folded into "Weitere". */
export function expensesByCategory(
  txs: Tx[],
  month: string,
  categories: { id: string; name: string }[],
  limit = 8,
): CategoryTotal[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const sums = new Map<string | undefined, number>();
  for (const t of txs) {
    if (t.kind !== 'expense' || monthOf(t.date) !== month) continue;
    const key = t.categoryId && names.has(t.categoryId) ? t.categoryId : undefined;
    sums.set(key, (sums.get(key) ?? 0) + t.amountMinor);
  }
  const rows: CategoryTotal[] = [...sums].map(([categoryId, amountMinor]) => ({
    categoryId,
    name: categoryId ? names.get(categoryId)! : UNCATEGORISED,
    amountMinor,
  }));
  rows.sort((a, b) => b.amountMinor - a.amountMinor || compareText(a.name, b.name));
  if (rows.length <= limit) return rows;
  const head = rows.slice(0, limit - 1);
  const tail = rows.slice(limit - 1);
  return [...head, { name: OTHERS, amountMinor: tail.reduce((s, r) => s + r.amountMinor, 0) }];
}

export interface MonthPoint extends MonthSummary {
  month: string;
  /** Short label, e.g. "Sep." */
  label: string;
}

/** The `count` months ending at (and including) `endMonth`, oldest first. */
export function monthlyTrend(txs: Tx[], endMonth: string, count = 6): MonthPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const month = addMonthsToMonth(endMonth, i - (count - 1));
    return { month, label: formatDay(`${month}-01`, 'MMM'), ...monthSummary(txs, month) };
  });
}

export interface Availability {
  balance: number;
  openInvoices: number;
  subscriptions: number;
  /** Balance minus everything that is still going to be paid. */
  available: number;
}

export function availability(
  balance: number,
  openInvoices: number,
  subscriptions: number,
): Availability {
  return {
    balance,
    openInvoices,
    subscriptions,
    available: balance - openInvoices - subscriptions,
  };
}

export function sortAccounts<T extends { order: number; name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order || compareText(a.name, b.name));
}
