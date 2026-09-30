import { DATE_RE, addDaysStr, daysBetween, isoWeekday, parseDate } from '@/core/time/dates';
import { getISOWeek } from 'date-fns';

export const isValidDate = (s: string): boolean =>
  DATE_RE.test(s) && !Number.isNaN(parseDate(s).getTime()) && addDaysStr(s, 0) === s;

/** Signed days from `a` to `b`, plus the split into whole weeks and remaining days. */
export function difference(
  a: string,
  b: string,
): { days: number; weeks: number; rest: number } | undefined {
  if (!isValidDate(a) || !isValidDate(b)) return undefined;
  const days = daysBetween(a, b);
  const abs = Math.abs(days);
  return { days, weeks: Math.floor(abs / 7), rest: abs % 7 };
}

export function addDays(start: string, days: number): string | undefined {
  if (!isValidDate(start) || !Number.isInteger(days) || Math.abs(days) > 365_000) return undefined;
  return addDaysStr(start, days);
}

/** ISO weekday (1 = Monday) and ISO calendar week number of a date. */
export function weekInfo(date: string): { weekday: number; week: number } | undefined {
  if (!isValidDate(date)) return undefined;
  return { weekday: isoWeekday(date), week: getISOWeek(parseDate(date)) };
}
