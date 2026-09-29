import {
  addDaysStr,
  addMonthsStr,
  daysBetween,
  endOfMonthStr,
  formatDay,
  startOfMonthStr,
  startOfWeekStr,
} from '@/core/time/dates';
import type { CalendarItem, DateRange } from '@/core/modules/types';
import { datesInRange } from '@/core/recurrence/expand';
import type { CalendarEvent } from './schema';

export type CalendarView = 'month' | 'week' | 'day';
export const VIEWS: CalendarView[] = ['month', 'week', 'day'];

export function isView(v: string | null): v is CalendarView {
  return v === 'month' || v === 'week' || v === 'day';
}

/** The visible date range of a view around `date` (month view includes the surrounding weeks). */
export function rangeFor(view: CalendarView, date: string): DateRange {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const from = startOfWeekStr(date);
    return { from, to: addDaysStr(from, 6) };
  }
  return {
    from: startOfWeekStr(startOfMonthStr(date)),
    to: addDaysStr(startOfWeekStr(endOfMonthStr(date)), 6),
  };
}

export function shiftDate(view: CalendarView, date: string, dir: 1 | -1): string {
  if (view === 'day') return addDaysStr(date, dir);
  if (view === 'week') return addDaysStr(date, 7 * dir);
  return addMonthsStr(startOfMonthStr(date), dir);
}

/** Weeks (Monday first) of the month grid, each an array of 7 dates. */
export function monthWeeks(date: string): string[][] {
  const { from, to } = rangeFor('month', date);
  const weeks: string[][] = [];
  for (let start = from; start <= to; start = addDaysStr(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysStr(start, i)));
  }
  return weeks;
}

export function viewTitle(view: CalendarView, date: string): string {
  if (view === 'month') return formatDay(date, 'LLLL yyyy');
  if (view === 'day') return formatDay(date, 'EEEE, d. MMMM yyyy');
  const { from, to } = rangeFor('week', date);
  return `${formatDay(from, "'KW' II")} · ${formatDay(from, 'd. MMM')} – ${formatDay(to, 'd. MMM yyyy')}`;
}

export function groupByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const i of items) {
    const list = map.get(i.date) ?? [];
    list.push(i);
    map.set(i.date, list);
  }
  return map;
}

/**
 * Expands stored events into per-day calendar items within `range`. Handles recurrence and
 * multi-day events (each covered day becomes one item; only the first day shows the start time).
 */
export function expandEvent(id: string, e: CalendarEvent, range: DateRange): CalendarItem[] {
  const span = e.endDate ? daysBetween(e.startDate, e.endDate) : 0;
  // An occurrence starting up to `span` days before the range can still reach into it.
  const starts = datesInRange(e.startDate, e.recurrence, addDaysStr(range.from, -span), range.to);
  const items: CalendarItem[] = [];
  for (const start of starts) {
    for (let k = 0; k <= span; k++) {
      const date = addDaysStr(start, k);
      if (date < range.from || date > range.to) continue;
      const first = k === 0;
      const last = k === span;
      const timed = !e.allDay && first && Boolean(e.startTime);
      items.push({
        id: `${id}:${date}`,
        source: 'calendar',
        kind: 'event',
        title: e.title,
        date,
        time: timed ? e.startTime : undefined,
        endTime: !e.allDay && last && e.endTime ? e.endTime : undefined,
        allDay: !timed,
        to: `/calendar?view=day&date=${date}`,
      });
    }
  }
  return items;
}

/** Event id encoded in an item id (`<eventId>:<date>`). */
export const eventIdOf = (itemId: string): string => itemId.slice(0, itemId.lastIndexOf(':'));
