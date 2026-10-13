import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import type { Recurrence } from './types';

export const weekdayShort = (iso: number): string => t.recurrence.weekdaysShort[iso - 1] ?? '';
export const monthName = (m: number): string => t.recurrence.months[m - 1] ?? '';

/** Human-readable description in the UI language, e.g. "Jeden 1. des Monats". */
export function describeRecurrence(rule: Recurrence | undefined): string {
  const d = t.recurrence.describe;
  if (!rule) return d.once;
  const n = rule.interval ?? 1;
  let base: string;
  switch (rule.freq) {
    case 'daily':
      base = d.daily(n);
      break;
    case 'weekly': {
      const days = rule.byWeekday?.length ? [...rule.byWeekday].sort((a, b) => a - b) : [];
      base = d.weekly(n) + (days.length ? d.onWeekdays(days.map(weekdayShort).join(', ')) : '');
      break;
    }
    case 'monthly': {
      if (rule.byMonthDay === -1) base = d.monthlyOnLastDay(n);
      else if (rule.byMonthDay) base = d.monthlyOnDay(rule.byMonthDay, n);
      else base = d.monthly(n);
      break;
    }
    case 'yearly': {
      let when = '';
      if (rule.byMonthDay && rule.monthOfYear) {
        const month = monthName(rule.monthOfYear);
        when =
          rule.byMonthDay === -1
            ? d.yearlyOnMonthEnd(month)
            : d.yearlyOnDay(rule.byMonthDay, month);
      }
      base = d.yearly(n) + when;
      break;
    }
  }
  if (rule.count) base += d.times(rule.count);
  if (rule.until) base += d.until(formatDay(rule.until, 'd. MMM yyyy'));
  return base;
}
