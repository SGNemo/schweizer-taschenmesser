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
export function rangeFor(view: CalendarView, date: string, weekStart: 1 | 7 = 1): DateRange {
  if (view === 'day') return { from: date, to: date };
  if (view === 'week') {
    const from = startOfWeekStr(date, weekStart);
    return { from, to: addDaysStr(from, 6) };
  }
  return {
    from: startOfWeekStr(startOfMonthStr(date), weekStart),
    to: addDaysStr(startOfWeekStr(endOfMonthStr(date), weekStart), 6),
  };
}

export function shiftDate(view: CalendarView, date: string, dir: 1 | -1): string {
  if (view === 'day') return addDaysStr(date, dir);
  if (view === 'week') return addDaysStr(date, 7 * dir);
  return addMonthsStr(startOfMonthStr(date), dir);
}

/** Weeks (Monday first unless `weekStart` is 7) of the month grid, each an array of 7 dates. */
export function monthWeeks(date: string, weekStart: 1 | 7 = 1): string[][] {
  const { from, to } = rangeFor('month', date, weekStart);
  const weeks: string[][] = [];
  for (let start = from; start <= to; start = addDaysStr(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysStr(start, i)));
  }
  return weeks;
}

export function viewTitle(view: CalendarView, date: string, weekStart: 1 | 7 = 1): string {
  if (view === 'month') return formatDay(date, 'LLLL yyyy');
  if (view === 'day') return formatDay(date, 'EEEE, d. MMMM yyyy');
  const { from, to } = rangeFor('week', date, weekStart);
  // Sunday-first weeks take the ISO week number of their Monday, not of the Sunday before it.
  const kw = weekStart === 7 ? addDaysStr(from, 1) : from;
  return `${formatDay(kw, "'KW' II")} · ${formatDay(from, 'd. MMM')} – ${formatDay(to, 'd. MMM yyyy')}`;
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
export function expandEvent(
  id: string,
  e: Omit<CalendarEvent, 'kind' | 'notify'> & { kind?: string },
  range: DateRange,
): CalendarItem[] {
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
        kind: e.kind === 'reminder' ? 'reminder' : 'event',
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

export interface TimedItem {
  item: CalendarItem;
  /** Minutes since 00:00. */
  start: number;
  end: number;
  /** Column within the overlap cluster and the cluster's column count. */
  lane: number;
  lanes: number;
}

/** Shortest block shown for an item without (or with a too short) duration, in minutes. */
export const MIN_BLOCK_MINUTES = 30;
/** Duration assumed for an item that has a start time but no end time, in minutes. */
export const DEFAULT_BLOCK_MINUTES = 60;

const toMinutes = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Splits one day into timed items (positioned in a time grid) and untimed ones (all-day row). */
export function splitDay(items: CalendarItem[]): { untimed: CalendarItem[]; timed: TimedItem[] } {
  const untimed = items.filter((i) => i.allDay || !i.time);
  const sorted = items
    .filter((i) => !i.allDay && i.time)
    .map((item) => {
      const start = toMinutes(item.time!);
      const rawEnd = item.endTime ? toMinutes(item.endTime) : start + DEFAULT_BLOCK_MINUTES;
      // Clamp to the day; an end before the start (multi-day) runs to midnight.
      const end = Math.min(
        24 * 60,
        Math.max(rawEnd > start ? rawEnd : 24 * 60, start + MIN_BLOCK_MINUTES),
      );
      return { item, start, end, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // Overlap clusters: consecutive items that touch a running end time share columns.
  let cluster: TimedItem[] = [];
  let clusterEnd = 0;
  const laneEnds: number[] = [];
  const close = () => {
    for (const t of cluster) t.lanes = laneEnds.length;
    cluster = [];
    laneEnds.length = 0;
  };
  for (const t of sorted) {
    if (cluster.length && t.start >= clusterEnd) close();
    let lane = laneEnds.findIndex((e) => e <= t.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = t.end;
    t.lane = lane;
    cluster.push(t);
    clusterEnd = Math.max(clusterEnd, t.end);
  }
  close();
  return { untimed, timed: sorted };
}
