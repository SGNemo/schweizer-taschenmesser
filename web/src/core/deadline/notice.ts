/**
 * Notice periods are stored in days (`cancelNoticeDays`, `noticeDays`); people think in weeks and
 * months. A month counts as 30 days, so "3 Monate" and "90 Tage" are the same stored value.
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
