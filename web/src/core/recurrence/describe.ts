import { formatDay } from '@/core/time/dates';
import type { Recurrence } from './types';

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export const weekdayName = (iso: number): string => WEEKDAYS[iso - 1] ?? '';
export const weekdayShort = (iso: number): string => WEEKDAYS_SHORT[iso - 1] ?? '';
export const monthName = (m: number): string => MONTHS[m - 1] ?? '';

/** Human-readable German description, e.g. "Jeden 1. des Monats". */
export function describeRecurrence(rule: Recurrence | undefined): string {
  if (!rule) return 'Einmalig';
  const n = rule.interval ?? 1;
  let base: string;
  switch (rule.freq) {
    case 'daily':
      base = n === 1 ? 'Täglich' : `Alle ${n} Tage`;
      break;
    case 'weekly': {
      const days = rule.byWeekday?.length ? [...rule.byWeekday].sort((a, b) => a - b) : [];
      const on = days.length ? ` (${days.map(weekdayShort).join(', ')})` : '';
      base = (n === 1 ? 'Wöchentlich' : `Alle ${n} Wochen`) + on;
      break;
    }
    case 'monthly': {
      const day =
        rule.byMonthDay === -1 ? 'letzten' : rule.byMonthDay ? `${rule.byMonthDay}.` : undefined;
      const every = n === 1 ? 'des Monats' : `alle ${n} Monate`;
      base = day ? `Jeden ${day} ${every}` : n === 1 ? 'Monatlich' : `Alle ${n} Monate`;
      break;
    }
    case 'yearly': {
      const when =
        rule.byMonthDay && rule.monthOfYear
          ? ` am ${rule.byMonthDay === -1 ? 'Monatsende' : `${rule.byMonthDay}.`} ${monthName(rule.monthOfYear)}`
          : '';
      base = (n === 1 ? 'Jährlich' : `Alle ${n} Jahre`) + when;
      break;
    }
  }
  if (rule.count) base += `, ${rule.count}×`;
  if (rule.until) base += `, bis ${formatDay(rule.until, 'd. MMM yyyy')}`;
  return base;
}
