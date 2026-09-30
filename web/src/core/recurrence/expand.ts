import { addDays, getDaysInMonth, getISODay, startOfISOWeek } from 'date-fns';
import { parseDate, toDateString } from '@/core/time/dates';
import type { Recurrence } from './types';

/** Hard stop against runaway iteration (≈ 137 years of daily occurrences). */
const MAX_ITERATIONS = 50_000;

/** Day of month for the wanted day, clamped to the month length ("every 31st" → Feb 28/29). */
function clampDay(year: number, monthIndex: number, want: number): number {
  const dim = getDaysInMonth(new Date(year, monthIndex, 1));
  return want === -1 ? dim : Math.min(want, dim);
}

/** Candidate dates in strictly increasing order; may include dates before `start`. */
function* candidates(rule: Recurrence, start: Date): Generator<Date> {
  const interval = rule.interval ?? 1;
  switch (rule.freq) {
    case 'daily':
      for (let k = 0; k < MAX_ITERATIONS; k++) yield addDays(start, k * interval);
      return;
    case 'weekly': {
      const weekdays = [
        ...new Set(rule.byWeekday?.length ? rule.byWeekday : [getISODay(start)]),
      ].sort((a, b) => a - b);
      const weekStart = startOfISOWeek(start);
      for (let k = 0; k < MAX_ITERATIONS; k++) {
        for (const wd of weekdays) yield addDays(weekStart, k * 7 * interval + wd - 1);
      }
      return;
    }
    case 'monthly':
      for (let k = 0; k < MAX_ITERATIONS; k++) {
        const total = start.getMonth() + k * interval;
        const year = start.getFullYear() + Math.floor(total / 12);
        const month = total % 12;
        yield new Date(year, month, clampDay(year, month, rule.byMonthDay ?? start.getDate()));
      }
      return;
    case 'yearly':
      for (let k = 0; k < MAX_ITERATIONS; k++) {
        const year = start.getFullYear() + k * interval;
        const month = (rule.monthOfYear ?? start.getMonth() + 1) - 1;
        yield new Date(year, month, clampDay(year, month, rule.byMonthDay ?? start.getDate()));
      }
      return;
  }
}

/** All occurrences from `start` on ('YYYY-MM-DD'), honouring `until` and `count`. */
export function* iterateOccurrences(rule: Recurrence, start: string): Generator<string> {
  let produced = 0;
  for (const d of candidates(rule, parseDate(start))) {
    const ds = toDateString(d);
    if (ds < start) continue;
    if (rule.until && ds > rule.until) return;
    yield ds;
    produced++;
    if (rule.count && produced >= rule.count) return;
  }
}

/** Occurrences within [from, to] (inclusive). */
export function occurrencesBetween(
  rule: Recurrence,
  start: string,
  from: string,
  to: string,
): string[] {
  const out: string[] = [];
  for (const ds of iterateOccurrences(rule, start)) {
    if (ds > to) break;
    if (ds >= from) out.push(ds);
  }
  return out;
}

/** The first occurrence strictly after `after`, or undefined when the rule has ended. */
export function nextOccurrence(rule: Recurrence, start: string, after: string): string | undefined {
  for (const ds of iterateOccurrences(rule, start)) if (ds > after) return ds;
  return undefined;
}

/** First occurrence on or after `from`. */
export function firstOnOrAfter(rule: Recurrence, start: string, from: string): string | undefined {
  for (const ds of iterateOccurrences(rule, start)) if (ds >= from) return ds;
  return undefined;
}

/** Dates of an item that may or may not repeat, within [from, to]. */
export function datesInRange(
  start: string,
  rule: Recurrence | undefined,
  from: string,
  to: string,
): string[] {
  if (!rule) return start >= from && start <= to ? [start] : [];
  return occurrencesBetween(rule, start, from, to);
}
