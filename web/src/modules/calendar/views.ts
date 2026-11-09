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

export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'year';
export const VIEWS: CalendarView[] = ['month', 'week', 'day', 'agenda', 'year'];

/** Days the agenda list reaches ahead of the shown date. */
export const AGENDA_DAYS = 30;

export function isView(v: string | null): v is CalendarView {
  return v !== null && (VIEWS as string[]).includes(v);
}

/** The visible date range of a view around `date` (month view includes the surrounding weeks). */
export function rangeFor(view: CalendarView, date: string, weekStart: 1 | 7 = 1): DateRange {
  if (view === 'day') return { from: date, to: date };
  if (view === 'agenda') return { from: date, to: addDaysStr(date, AGENDA_DAYS - 1) };
  if (view === 'year')
    return { from: `${date.slice(0, 4)}-01-01`, to: `${date.slice(0, 4)}-12-31` };
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
  if (view === 'agenda') return addDaysStr(date, AGENDA_DAYS * dir);
  if (view === 'year') return addMonthsStr(startOfMonthStr(date), 12 * dir);
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
  if (view === 'year') return formatDay(date, 'yyyy');
  if (view === 'agenda') {
    const { from, to } = rangeFor('agenda', date, weekStart);
    return `${formatDay(from, 'd. MMM')} – ${formatDay(to, 'd. MMM yyyy')}`;
  }
  if (view === 'day') return formatDay(date, 'EEEE, d. MMMM yyyy');
  const { from, to } = rangeFor('week', date, weekStart);
  // Sunday-first weeks take the ISO week number of their Monday, not of the Sunday before it.
  const kw = weekStart === 7 ? addDaysStr(from, 1) : from;
  return `${formatDay(kw, "'KW' II")} · ${formatDay(from, 'd. MMM')} – ${formatDay(to, 'd. MMM yyyy')}`;
}

/** ISO week number of the week a row starts with; Sunday-first rows take the Monday after. */
export function weekNumberOf(weekFirstDay: string, weekStart: 1 | 7 = 1): string {
  return formatDay(weekStart === 7 ? addDaysStr(weekFirstDay, 1) : weekFirstDay, 'II');
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
  const skipped = e.exdates?.length ? new Set(e.exdates) : null;
  const starts = datesInRange(
    e.startDate,
    e.recurrence,
    addDaysStr(range.from, -span),
    range.to,
  ).filter((s) => !skipped?.has(s));
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
        // The end belongs to the last day; the first day of a multi-day entry names it too.
        endTime: !e.allDay && (last || (first && timed)) && e.endTime ? e.endTime : undefined,
        ...(first && span > 0 && e.endDate ? { endDate: e.endDate } : {}),
        ...(first ? {} : { continued: true }),
        allDay: !timed,
        ...(e.personId ? { personId: e.personId } : {}),
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
      const spans = !!item.endDate && item.endDate > item.date;
      const rawEnd = item.endTime ? toMinutes(item.endTime) : start + DEFAULT_BLOCK_MINUTES;
      // Clamp to the day; an end before the start, or on a later day, runs to midnight.
      const end = Math.min(
        24 * 60,
        Math.max(rawEnd > start && !spans ? rawEnd : 24 * 60, start + MIN_BLOCK_MINUTES),
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

/** Untimed entries a day shows in the week grid's all-day pane; the rest folds into "+n weitere" (S04, UI round 6). */
export const ALL_DAY_LIMIT = 3;

/**
 * Minute the hour grid opens at: an hour and a half before `anchor` (now, or the first entry), on a full hour, and never
 * inside a block. A block cut by the grid's top edge looks as if it were hidden under the all-day pane above it (S04), so
 * the start moves up to the full hour before such a block – but never more than two hours above the first choice: a long
 * block (05:00–22:00) or a chain of overlapping ones must not open the grid far from now.
 */
export function initialScrollMinute(
  blocks: readonly { start: number; end: number }[],
  anchor: number,
): number {
  const top0 = Math.max(0, Math.floor((anchor - 90) / 60) * 60);
  let top = top0;
  for (;;) {
    const cut = blocks.find((b) => b.start < top && b.end > top && b.start >= top0 - 120);
    if (!cut) return top;
    top = Math.floor(cut.start / 60) * 60;
  }
}

/** What the hour grid remembers about its scroll: the shown range, and whether that range's entries have been seen. */
export interface GridScrollMemo {
  range: string;
  settled: boolean;
}

/**
 * Whether the hour grid scrolls now (S04, UI round 6). A new range always scrolls. The same range scrolls once more only
 * while its entries are still loading (none of the shown days had any entry yet) and timed entries arrive; once entries
 * were seen, the user's own edits (the first timed event saved into an all-day-only week, the last one deleted) never
 * move the grid.
 */
export function gridScroll(
  memo: GridScrollMemo | null,
  range: string,
  hasAny: boolean,
  hasTimed: boolean,
): { scroll: boolean; memo: GridScrollMemo } {
  if (!memo || memo.range !== range) return { scroll: true, memo: { range, settled: hasAny } };
  if (memo.settled || !hasAny) return { scroll: false, memo };
  return { scroll: hasTimed, memo: { range, settled: true } };
}

/** Identity of an entry across days: the same source, kind, time and title. */
export const repeatKey = (i: Pick<CalendarItem, 'source' | 'kind' | 'time' | 'title'>): string =>
  `${i.source}|${i.kind}|${i.time ?? ''}|${i.title}`;

/**
 * Entries that come back almost every day (five or more times within seven days – a daily medication reminder). The month
 * view writes them as quiet lines, so the one-off entries stand out (S03, UI round 6).
 */
export function dailyRepeats(items: readonly CalendarItem[]): Set<string> {
  const days = new Map<string, string[]>();
  for (const i of items) {
    const key = repeatKey(i);
    const list = days.get(key) ?? [];
    if (!list.includes(i.date)) list.push(i.date);
    days.set(key, list);
  }
  const out = new Set<string>();
  for (const [key, list] of days) {
    if (list.length < 5) continue;
    list.sort();
    for (let n = 0; n + 4 < list.length; n++)
      if (daysBetween(list[n]!, list[n + 4]!) <= 6) {
        out.add(key);
        break;
      }
  }
  return out;
}
