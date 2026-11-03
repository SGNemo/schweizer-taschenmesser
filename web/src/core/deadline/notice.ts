import { addDaysStr, addMonthsStr } from '@/core/time/dates';

/**
 * Notice periods are stored in days (`cancelNoticeDays`, `noticeDays`); people think in weeks and
 * months. For "3 Monate" the record also keeps `…Months` (3): the deadline then moves by calendar
 * months (31 Jan − 1 month = 28 Feb), not by a fixed 30 days. The days stay as months × 30, so older
 * versions, the assistant and the mail heuristics keep working; the months count only while it still
 * matches the days (`noticeMonthsOf`), so a change of the days alone never leaves a stale month value.
 */
export const NOTICE_UNITS = ['days', 'weeks', 'months'] as const;
export type NoticeUnit = (typeof NOTICE_UNITS)[number];

const DAYS_PER: Record<NoticeUnit, number> = { days: 1, weeks: 7, months: 30 };

/** Days for an entered amount; undefined when empty or not a number, clamped to 0..`max`. */
export function noticeToDays(text: string, unit: NoticeUnit, max: number): number | undefined {
  if (text.trim() === '') return undefined;
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(max, Math.round(n * DAYS_PER[unit])));
}

/** The largest unit that shows the stored days exactly (90 → 3 months, 14 → 2 weeks, 10 → 10 days). */
export function daysToNotice(days: number): { amount: number; unit: NoticeUnit } {
  if (days >= 30 && days % 30 === 0) return { amount: days / 30, unit: 'months' };
  if (days >= 7 && days % 7 === 0) return { amount: days / 7, unit: 'weeks' };
  return { amount: days, unit: 'days' };
}

/** A stored notice period: days, plus the month count when it was entered in months. */
export interface NoticeValue {
  days: number;
  months?: number;
}

/** The month count if it still describes the days (months × 30), else undefined. */
export function noticeMonthsOf(n: NoticeValue): number | undefined {
  return n.months !== undefined &&
    Number.isInteger(n.months) &&
    n.months >= 1 &&
    n.months * 30 === n.days
    ? n.months
    : undefined;
}

/** `date` plus the notice period (calendar months when entered in months, else days). */
export function plusNotice(date: string, n: NoticeValue): string {
  const m = noticeMonthsOf(n);
  return m !== undefined ? addMonthsStr(date, m) : addDaysStr(date, n.days);
}

/** `date` minus the notice period: the last day to give notice for something that ends on `date`. */
export function minusNotice(date: string, n: NoticeValue): string {
  const m = noticeMonthsOf(n);
  return m !== undefined ? addMonthsStr(date, -m) : addDaysStr(date, -n.days);
}

/** Entered amount and unit as the stored pair; `months` only for a whole number of months within `max` days. */
export function noticeFromInput(
  text: string,
  unit: NoticeUnit,
  max: number,
): { days: number; months?: number } | undefined {
  const days = noticeToDays(text, unit, max);
  if (days === undefined) return undefined;
  if (unit !== 'months') return { days };
  const n = Number(text.replace(',', '.'));
  return Number.isInteger(n) && n >= 1 && n * 30 <= max ? { days, months: n } : { days };
}
