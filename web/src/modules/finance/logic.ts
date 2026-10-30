import { compareText } from '@/core/i18n/format';
import { addMonthsStr, addMonthsToMonth, formatDay, monthOf } from '@/core/time/dates';
import { currencyOf, DEFAULT_CURRENCY, formatMoneyInput } from '@/core/money';
import type { Account, BookingRepeat, Transaction } from './schema';

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

export interface TxFilter {
  /** Free text: payee, note, category name or the amount ("45", "12,50"). */
  query: string;
  kind: 'all' | 'expense' | 'income';
}

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Bookings that match the text (all words must appear) and the kind. Pure; the caller decides which months to pass in. */
export function filterTransactions<T extends Tx & { payee?: string; note?: string }>(
  txs: readonly T[],
  filter: TxFilter,
  categoryName: (id: string | undefined) => string | undefined,
): T[] {
  const words = fold(filter.query).split(/\s+/).filter(Boolean);
  return txs.filter((x) => {
    if (filter.kind !== 'all' && x.kind !== filter.kind) return false;
    if (words.length === 0) return true;
    const hay = fold(
      [x.payee, x.note, categoryName(x.categoryId), formatMoneyInput(x.amountMinor)]
        .filter(Boolean)
        .join(' '),
    );
    return words.every((w) => hay.includes(w));
  });
}

/** What the same payee was booked with last (same kind, case-insensitive, newest booking wins); fills the dialog so a repeat booking needs only the amount. */
export function lastUsedFor(
  txs: readonly (Tx & { payee?: string; createdAt: number })[],
  payee: string,
  kind: Tx['kind'],
): { categoryId?: string; accountId: string } | undefined {
  const key = payee.trim().toLocaleLowerCase();
  if (!key) return undefined;
  const hit = txs
    .filter((x) => x.kind === kind && x.payee?.trim().toLocaleLowerCase() === key)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0];
  return hit ? { categoryId: hit.categoryId, accountId: hit.accountId } : undefined;
}

const REPEAT_MONTHS: Record<BookingRepeat, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** At most this many missed periods are booked per series and start (a long break never floods the list). */
const MAX_CATCH_UP = 12;

export type PlannedRepeat = { id: string; data: Transaction };

/**
 * The follow-up bookings of repeating series whose date has come (<= `day`). Ids derive from the
 * series root and the date, so two devices create the same booking and sync converges. Only the
 * newest booking of a series keeps `repeat`; `clear` lists the heads that hand it on.
 */
export function planRepeats(
  heads: (Transaction & { id: string })[],
  day: string,
): { create: PlannedRepeat[]; clear: string[] } {
  const create: PlannedRepeat[] = [];
  const clear: string[] = [];
  for (const head of heads) {
    if (!head.repeat) continue;
    const root = head.repeatOf ?? head.id;
    const months = REPEAT_MONTHS[head.repeat];
    let { date } = head;
    let made = 0;
    while (made < MAX_CATCH_UP) {
      const next = addMonthsStr(date, months);
      if (next > day) break;
      const { id: _id, ...base } = head;
      create.push({
        id: `rep-${root}-${next}`,
        data: { ...base, date: next, repeat: head.repeat, repeatOf: root, sourceRef: undefined },
      });
      date = next;
      made++;
    }
    if (made > 0) {
      clear.push(head.id);
      // Only the newest keeps the series alive.
      for (let i = create.length - made; i < create.length - 1; i++)
        create[i]!.data.repeat = undefined;
    }
  }
  return { create, clear };
}

/** Currencies of the accounts, the euro first; the euro when there are no accounts. */
export function currenciesOf(accounts: Pick<Account, 'currency'>[]): string[] {
  const set = new Set(accounts.map((a) => currencyOf(a)));
  if (set.size === 0) return [DEFAULT_CURRENCY];
  return [...set].sort((a, b) =>
    a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
  );
}

/** Only the accounts in `currency` and their bookings; amounts of different currencies are never mixed. */
export function filterByCurrency<
  D extends {
    accounts: (Pick<Account, 'currency'> & { id: string })[];
    txs: { accountId: string }[];
  },
>(data: D, currency: string): D {
  const accounts = data.accounts.filter((a) => currencyOf(a) === currency);
  const ids = new Set(accounts.map((a) => a.id));
  return { ...data, accounts, txs: data.txs.filter((x) => ids.has(x.accountId)) };
}
