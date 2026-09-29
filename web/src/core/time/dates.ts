/**
 * Calendar-date helpers on 'YYYY-MM-DD' strings (local time, no timezone pitfalls).
 * Date-only values are stored as strings everywhere; Date objects only exist inside these helpers.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getISODay,
  startOfISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { toDateString, today } from './now';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export const addDaysStr = (s: string, n: number): string => toDateString(addDays(parseDate(s), n));
export const addMonthsStr = (s: string, n: number): string =>
  toDateString(addMonths(parseDate(s), n));
export const daysBetween = (a: string, b: string): number =>
  differenceInCalendarDays(parseDate(b), parseDate(a));
/** ISO weekday: Monday = 1 … Sunday = 7. */
export const isoWeekday = (s: string): number => getISODay(parseDate(s));
export const startOfWeekStr = (s: string): string => toDateString(startOfISOWeek(parseDate(s)));
export const startOfMonthStr = (s: string): string => `${s.slice(0, 7)}-01`;
export const endOfMonthStr = (s: string): string =>
  toDateString(new Date(parseDate(s).getFullYear(), parseDate(s).getMonth() + 1, 0));
/** 'YYYY-MM' of a date string. */
export const monthOf = (s: string): string => s.slice(0, 7);
export const addMonthsToMonth = (month: string, n: number): string =>
  monthOf(addMonthsStr(`${month}-01`, n));
export const formatMonth = (month: string): string => formatDay(`${month}-01`, 'LLLL yyyy');

export const tomorrow = (): string => addDaysStr(today(), 1);

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

/** Locale-formatted date, e.g. formatDay('2026-09-29', 'EEEE, d. MMMM') → "Dienstag, 29. September". */
export const formatDay = (s: string, pattern: string): string =>
  format(parseDate(s), pattern, { locale: de });

/** "Heute" / "Morgen" / "Gestern" or a short weekday date. */
export function relativeDayLabel(s: string, ref: string = today()): string {
  const diff = daysBetween(ref, s);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === -1) return 'Gestern';
  return formatDay(s, 'EEE, d. MMM');
}

/** Epoch ms of a local date + 'HH:mm'. */
export function toEpoch(date: string, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = parseDate(date);
  d.setHours(h!, m!, 0, 0);
  return d.getTime();
}

export { today, toDateString };
