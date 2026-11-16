/**
 * The figures behind the budget charts (pure, integer cents): what is left per day, where the month
 * ends, a limit's share of one month, spending rolled up to top-level categories, and the totals of the
 * head. No React, no database: `data.ts` feeds them, the page draws them with `@/ui/charts`.
 */
import { daysBetween } from '@/core/time/dates';
import type { BudgetPeriod } from './schema';

type Cat = { id: string; parentId?: string };

export interface DailyRate {
  /** Cents per day still free; 0 when nothing is left. */
  perDay: number;
  /** Days left including today (≥ 1 while the period runs). */
  daysLeft: number;
}

/**
 * What can still be spent per day until `to` (inclusive): the free amount spread over the days left,
 * today included. Rounded down, so the days together never exceed what is free. None before or after
 * the period: a closed month has no "per day" any more.
 */
export function dailyRate(
  free: number,
  from: string,
  to: string,
  today: string,
): DailyRate | undefined {
  if (today < from || today > to) return undefined;
  const daysLeft = daysBetween(today, to) + 1;
  return { perDay: Math.max(0, Math.floor(free / daysLeft)), daysLeft };
}

/** A limit as an amount per month: a quarter's limit counts a third, a year's a twelfth (rounded). */
export const monthlyShare = (limit: number, period: BudgetPeriod): number =>
  period === 'quarter' ? Math.round(limit / 3) : period === 'year' ? Math.round(limit / 12) : limit;

/**
 * Spending per category id rolled up to the top-level category (a child counts for its parent), so the
 * donut names the categories people chose a budget for. A child whose parent is gone counts for itself;
 * the key '' (no category) stays ''.
 */
export function rollUp(
  spent: ReadonlyMap<string, number>,
  categories: readonly Cat[],
): Map<string, number> {
  const known = new Set(categories.map((c) => c.id));
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const out = new Map<string, number>();
  for (const [id, cents] of spent) {
    if (cents <= 0) continue;
    const parent = parentOf.get(id);
    const key = parent && known.has(parent) ? parent : id;
    out.set(key, (out.get(key) ?? 0) + cents);
  }
  return out;
}

/** One running or closed budget as the head needs it. */
export interface HeadRow {
  period: BudgetPeriod;
  running: boolean;
  spent: number;
  limit: number;
  /** Forecast to the end of the period (only running ones, only with the forecast setting on). */
  projected?: number;
}

export interface HeadTotals {
  /** Monthly budgets only: the head speaks of "bis Monatsende". */
  limit: number;
  spent: number;
  /** Sum of what each monthly budget still has (an overrun does not eat another budget's rest). */
  free: number;
  /** Sum of the forecasts; none when a running monthly budget has no forecast (setting off). */
  projected?: number;
  /** Number of monthly budgets that count. */
  count: number;
}

/**
 * Totals of the running month's monthly budgets: the daily rate and the forecast are about the month's
 * end, so quarter and year budgets keep their own lines on the cards and stay out of it.
 */
export function headTotals(rows: readonly HeadRow[]): HeadTotals {
  const monthly = rows.filter((r) => r.period === 'month' && r.running);
  let projected: number | undefined = monthly.length ? 0 : undefined;
  let limit = 0;
  let spent = 0;
  let free = 0;
  for (const r of monthly) {
    limit += r.limit;
    spent += r.spent;
    free += Math.max(0, r.limit - r.spent);
    projected =
      r.projected === undefined || projected === undefined ? undefined : projected + r.projected;
  }
  return { limit, spent, free, projected, count: monthly.length };
}

/**
 * The spending line of the trend: a month before the first booking at all, and a month still to come,
 * is a gap (`null`), not a "0" – a line that rises from nothing would read like a jump in spending.
 */
export function trendValues(
  months: readonly string[],
  spent: readonly number[],
  hasSpending: readonly boolean[],
  thisMonth: string,
): (number | null)[] {
  const first = hasSpending.indexOf(true);
  return months.map((m, i) =>
    first < 0 || i < first || m > thisMonth ? null : (spent[i] ?? null),
  );
}
