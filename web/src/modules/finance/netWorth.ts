import { addMonthsToMonth, monthOf } from '@/core/time/dates';
import { signed } from './logic';
import type { Account, Transaction } from './schema';

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
 * month ends `through`, i.e. today). An account counts from the month of its first booking on
 * (opening balance included), so a late-opened account adds no fake zero before it; months before
 * any account started are left out. Transfers are two bookings that cancel in the sum. Only
 * accounts of one currency should be passed (nothing is converted). Pure.
 */
export function netWorthSeries(
  accounts: (Pick<Account, 'openingBalanceMinor'> & { id: string })[],
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
      const first = firstMonth.get(a.id);
      if (first && first <= month) {
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
