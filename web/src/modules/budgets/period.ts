/** Budget periods (pure): which months belong to a period, the periods before it, how far into it we are. */
import { addMonthsToMonth, daysBetween, endOfMonthStr } from '@/core/time/dates';
import type { BudgetPeriod } from './schema';

export interface PeriodInfo {
  period: BudgetPeriod;
  /** 'YYYY-MM' of every month in the period, in order. */
  months: string[];
  /** First and last day, 'YYYY-MM-DD'. */
  from: string;
  to: string;
  /** Calendar year of the period; `index` is the quarter (1–4) or the month (1–12), 1 for a year. */
  year: number;
  index: number;
}

/** The period that contains `month` ('YYYY-MM'): the month itself, its calendar quarter or its calendar year. */
export function periodOf(month: string, period: BudgetPeriod): PeriodInfo {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const first = period === 'month' ? m : period === 'quarter' ? Math.floor((m - 1) / 3) * 3 + 1 : 1;
  const count = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  const months = Array.from(
    { length: count },
    (_, i) => `${year}-${String(first + i).padStart(2, '0')}`,
  );
  return {
    period,
    months,
    from: `${months[0]}-01`,
    to: endOfMonthStr(`${months[count - 1]}-01`),
    year,
    index: period === 'month' ? m : period === 'quarter' ? (first - 1) / 3 + 1 : 1,
  };
}

/** A month inside the period before the one that contains `month`. */
export const previousPeriodMonth = (month: string, period: BudgetPeriod): string =>
  addMonthsToMonth(
    periodOf(month, period).months[0]!,
    -(period === 'month' ? 1 : period === 'quarter' ? 3 : 12),
  );

/** A month in each of the last `count` periods, oldest first, the last one in the period of `month`. */
export function pastPeriodMonths(month: string, period: BudgetPeriod, count: number): string[] {
  const step = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
  const start = periodOf(month, period).months[0]!;
  return Array.from({ length: count }, (_, i) => addMonthsToMonth(start, -step * (count - 1 - i)));
}

export interface Elapsed {
  /** Days in the period. */
  total: number;
  /** Days gone including today (0 before the period, `total` after it). */
  elapsed: number;
  /** The period contains today. */
  running: boolean;
}

export function elapsedIn(info: Pick<PeriodInfo, 'from' | 'to'>, today: string): Elapsed {
  const total = daysBetween(info.from, info.to) + 1;
  if (today < info.from) return { total, elapsed: 0, running: false };
  if (today > info.to) return { total, elapsed: total, running: false };
  return { total, elapsed: daysBetween(info.from, today) + 1, running: true };
}
