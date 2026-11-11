import { addMonthsToMonth, monthOf } from '@/core/time/dates';
import { toDateString } from '@/core/time/now';
import { currencyOf } from '@/core/money';
import { balances, currenciesOf, signed } from './logic';
import { ACCOUNT_KINDS, type Account, type AccountKind, type Transaction } from './schema';

type Tx = Pick<Transaction, 'accountId' | 'categoryId' | 'kind' | 'amountMinor' | 'date'>;

/** One point of a monthly trend; shared by the net-worth line and (wave 2) per-category trends. */
export interface MonthPoint {
  /** 'YYYY-MM'. */
  month: string;
  /** Cents. */
  valueMinor: number;
}

/** The last `count` months ending with `through`'s month, oldest first ('YYYY-MM'). */
export function lastMonths(through: string, count: number): string[] {
  const end = monthOf(through);
  return Array.from({ length: count }, (_, i) => addMonthsToMonth(end, i - (count - 1)));
}

/**
 * Total balance of the given accounts at each month end of the last `count` months (the running
 * month ends `through`, i.e. today). An account counts from its creation or first booking month on
 * (opening balance included, also without bookings), so a late-opened account adds no fake zero before it; months before
 * any account started are left out. Transfers are two bookings that cancel in the sum. Only
 * accounts of one currency should be passed (nothing is converted; a transfer across currencies counts as
 * income/expense there, like in the other finance views). Pure.
 */
export function netWorthSeries(
  accounts: (Pick<Account, 'openingBalanceMinor'> & { id: string; createdAt?: number })[],
  txs: readonly Tx[],
  through: string,
  count = 12,
): MonthPoint[] {
  const months = lastMonths(through, count);
  const ids = new Set(accounts.map((a) => a.id));
  const firstMonth = new Map<string, string>();
  const perMonth = new Map<string, number>(); // `${account}|${month}` → change in that month
  const beforeByAccount = new Map<string, number>();
  const windowStart = months[0]!;
  for (const t of txs) {
    if (!ids.has(t.accountId) || t.date > through) continue;
    const m = monthOf(t.date);
    const first = firstMonth.get(t.accountId);
    if (!first || m < first) firstMonth.set(t.accountId, m);
    if (m < windowStart) {
      beforeByAccount.set(t.accountId, (beforeByAccount.get(t.accountId) ?? 0) + signed(t));
    } else {
      const k = `${t.accountId}|${m}`;
      perMonth.set(k, (perMonth.get(k) ?? 0) + signed(t));
    }
  }
  // An account counts from the earlier of its creation and its first booking (older than the window: from the
  // window start); with neither known it counts from the window start. So the last point equals the summed balances.
  const startOf = (a: { id: string; createdAt?: number }): string => {
    const created =
      a.createdAt === undefined ? undefined : monthOf(toDateString(new Date(a.createdAt)));
    const booked = firstMonth.get(a.id);
    return [created, booked].filter((m): m is string => !!m).sort()[0] ?? windowStart;
  };
  const running = new Map<string, number>(
    accounts.map((a) => [a.id, a.openingBalanceMinor + (beforeByAccount.get(a.id) ?? 0)]),
  );
  const points: MonthPoint[] = [];
  for (const month of months) {
    let total = 0;
    let any = false;
    for (const a of accounts) {
      const next = (running.get(a.id) ?? 0) + (perMonth.get(`${a.id}|${month}`) ?? 0);
      running.set(a.id, next);
      if (startOf(a) <= month) {
        total += next;
        any = true;
      }
    }
    if (any) points.push({ month, valueMinor: total });
  }
  return points;
}

/** Change from the first to the last point and the month it is counted from; none below two points. */
export function changeOver(
  points: readonly MonthPoint[],
): { diffMinor: number; since: string } | undefined {
  if (points.length < 2) return undefined;
  const first = points[0]!;
  return {
    diffMinor: points[points.length - 1]!.valueMinor - first.valueMinor,
    since: first.month,
  };
}

/** The accounts of one kind inside one currency. */
export interface NetWorthPart {
  kind: AccountKind;
  /** Signed sum of the balances, cents. */
  valueMinor: number;
  /** How many accounts are of this kind. */
  accounts: number;
}

/** What the accounts of one currency hold together, split by the account's kind. */
export interface NetWorth {
  currency: string;
  /** Signed sum of all balances in this currency, cents. */
  totalMinor: number;
  accounts: number;
  /** Only kinds that have an account, in the order of `ACCOUNT_KINDS`. */
  parts: NetWorthPart[];
}

/** What an account is; one saved before version 4 (no `kind`) reads as a checking account. Nothing is written back. */
export const kindOf = (a: Pick<Account, 'kind'>): AccountKind => a.kind ?? 'checking';

/**
 * Net worth ("Vermögen") on `asOf`: the signed sum of the balances of all accounts (`balances()`), per currency and
 * split by the account's kind. One entry per currency, the main one first (`currenciesOf`); nothing is converted and
 * no two currencies are ever added. A card account is negative through its own bookings: there is no sign rule here.
 * Accounts are the only input: a savings goal (module Budgets) is a label on money that already lies on an account,
 * so it can never be counted a second time. Without accounts the list is empty. Pure.
 */
export function netWorth(
  accounts: (Pick<Account, 'openingBalanceMinor' | 'currency' | 'kind'> & { id: string })[],
  txs: readonly Tx[],
  asOf: string,
): NetWorth[] {
  if (accounts.length === 0) return [];
  const perAccount = balances(accounts, txs as Tx[], asOf);
  return currenciesOf(accounts).map((currency) => {
    const own = accounts.filter((a) => currencyOf(a) === currency);
    const parts = ACCOUNT_KINDS.map((kind): NetWorthPart => {
      const group = own.filter((a) => kindOf(a) === kind);
      return {
        kind,
        valueMinor: group.reduce((sum, a) => sum + (perAccount.get(a.id) ?? 0), 0),
        accounts: group.length,
      };
    }).filter((p) => p.accounts > 0);
    return {
      currency,
      totalMinor: parts.reduce((sum, p) => sum + p.valueMinor, 0),
      accounts: own.length,
      parts,
    };
  });
}
