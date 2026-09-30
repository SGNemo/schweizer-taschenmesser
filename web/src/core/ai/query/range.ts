import {
  addDaysStr,
  addMonthsStr,
  endOfMonthStr,
  startOfMonthStr,
  startOfWeekStr,
} from '@/core/time/dates';
import type { RelativeRange } from './schema';

/** Open-ended bounds are allowed (`overdue` has no start). Both ends are inclusive. */
export interface ResolvedRange {
  from?: string;
  to?: string;
}

/** Turns a relative range into concrete dates. Weeks run Monday–Sunday. */
export function resolveRelative(relative: RelativeRange, today: string): ResolvedRange {
  switch (relative) {
    case 'today':
      return { from: today, to: today };
    case 'tomorrow': {
      const d = addDaysStr(today, 1);
      return { from: d, to: d };
    }
    case 'yesterday': {
      const d = addDaysStr(today, -1);
      return { from: d, to: d };
    }
    case 'this_week': {
      const start = startOfWeekStr(today);
      return { from: start, to: addDaysStr(start, 6) };
    }
    case 'next_week': {
      const start = addDaysStr(startOfWeekStr(today), 7);
      return { from: start, to: addDaysStr(start, 6) };
    }
    case 'next_7_days':
      return { from: today, to: addDaysStr(today, 6) };
    case 'this_month':
      return { from: startOfMonthStr(today), to: endOfMonthStr(today) };
    case 'next_month': {
      const first = startOfMonthStr(addMonthsStr(startOfMonthStr(today), 1));
      return { from: first, to: endOfMonthStr(first) };
    }
    case 'last_month': {
      const first = startOfMonthStr(addMonthsStr(startOfMonthStr(today), -1));
      return { from: first, to: endOfMonthStr(first) };
    }
    case 'overdue':
      return { to: addDaysStr(today, -1) };
  }
}

/** Explicit `from`/`to` win over `relative`. */
export function resolveRange(
  range: { from?: string; to?: string; relative?: RelativeRange },
  today: string,
): ResolvedRange {
  const base = range.relative ? resolveRelative(range.relative, today) : {};
  return { from: range.from ?? base.from, to: range.to ?? base.to };
}
