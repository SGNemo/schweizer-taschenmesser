/**
 * The pure model behind the week board, the day sheet and the widget: stored rows + the live inputs →
 * one object per day with its capacity line, rows and blockers, plus the waiting list. The engine is
 * not run here; the board shows what the last run stored (`assignment` rows, `LastRun`).
 */
import type { PlannableEntry } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { capacity } from '@/core/plan/capacity';
import { DEFAULT_MIN, type PlaceReason, type Unplaced } from '@/core/plan/types';
import { planDays, type DayBlocker } from './days';
import { itemKeyOf } from './repo';
import type { AssignmentRow, PlanDayRow, PlanItemRow } from './schema';
import { defaultAvailable, type PlannerSettings } from './settings';
import { isoWeekday } from '@/core/time/dates';

export type BoardBlocker = DayBlocker;

export interface BoardRow {
  unitId: string;
  itemKey: string;
  title: string;
  minutes: number;
  k: number;
  of: number;
  reason: PlaceReason;
  bumpedBy?: string[];
  late?: boolean;
  /** No estimate on the source: shown as „~30 Min“. */
  approx: boolean;
  pinned: boolean;
  hardDue?: string;
  /** The source's own date before the planner (for „Warum hier?“ of a carried thing). */
  entry?: PlannableEntry;
  item?: PlanItemRow;
}

export interface BoardDay {
  date: string;
  isToday: boolean;
  /** Stored row, if the user touched the day. */
  row?: PlanDayRow;
  availableMin: number;
  raw: number;
  usable: number;
  planned: number;
  free: number;
  over: number;
  /** 0 minutes available: a day off. */
  off: boolean;
  /** The weekday's minutes from the settings (the „Arbeitswoche“ template). */
  defaultMin: number;
  /** The day's time window (its own or the weekday's), package 5. */
  window?: { from: string; to: string };
  /** The window is the day's own. */
  ownWindow?: boolean;
  blockers: BoardBlocker[];
  rows: BoardRow[];
}

export interface WaitingRow {
  unitId: string;
  itemKey: string;
  title: string;
  minutes: number;
  k: number;
  of: number;
  reason: Unplaced['reason'] | 'excluded';
  bumpedBy?: string[];
  entry?: PlannableEntry;
  item?: PlanItemRow;
}

export interface Board {
  days: BoardDay[];
  waiting: WaitingRow[];
  /** Open things in the plan today (first sessions). */
  todayCount: number;
}

export interface BoardInput {
  today: string;
  /** How many days from today. */
  span: number;
  settings: PlannerSettings;
  dayRows: readonly (PlanDayRow & { id: string })[];
  itemRows: readonly (PlanItemRow & { id: string })[];
  assignments: readonly (AssignmentRow & { id: string })[];
  entries: readonly PlannableEntry[];
  calendar: readonly CalendarItem[];
  unplaced: readonly Unplaced[];
  titles?: Record<string, string>;
}

export const unitTitle = (titles: Record<string, string>, unitId: string): string =>
  titles[unitId.slice(0, unitId.lastIndexOf('#'))] ?? unitId;

export function buildBoard(input: BoardInput): Board {
  const entries = new Map(input.entries.map((e) => [itemKeyOf(e.moduleId, e.id), e]));
  const items = new Map(input.itemRows.map((r) => [r.id, r]));
  const titles: Record<string, string> = { ...input.titles };
  for (const [key, e] of entries) titles[key] = e.title;
  const bufferShare = Number(input.settings.bufferShare) / 100;
  const built = planDays({
    today: input.today,
    span: input.span,
    settings: input.settings,
    dayRows: input.dayRows,
    calendar: input.calendar,
  });
  const days: BoardDay[] = built.map(({ date, availableMin, blockers, row, window, ownWindow }) => {
    const cap = capacity({ date, availableMin, blockers }, { bufferShare });
    const rows: BoardRow[] = input.assignments
      .filter((a) => a.date === date)
      .sort((a, b) => a.order - b.order)
      .map((a) => {
        const entry = entries.get(a.itemKey);
        const item = items.get(a.itemKey);
        return {
          unitId: a.id,
          itemKey: a.itemKey,
          title: titles[a.itemKey] ?? a.itemKey,
          minutes: a.minutes,
          k: a.k,
          of: a.of,
          reason: a.reason,
          ...(a.bumpedBy ? { bumpedBy: a.bumpedBy } : {}),
          ...(a.late ? { late: true } : {}),
          approx:
            item?.durationMin === undefined &&
            entry?.durationMin === undefined &&
            a.minutes === DEFAULT_MIN,
          pinned: item?.pinned === date,
          // A deadline marked in the plan, or one the source holds as hard (an invoice, a cancellation).
          ...(item?.due?.hard
            ? { hardDue: item.due.date }
            : entry?.due?.hard
              ? { hardDue: entry.due.date }
              : {}),
          ...(entry ? { entry } : {}),
          ...(item ? { item } : {}),
        };
      });
    const planned = rows.reduce((n, r) => n + r.minutes, 0);
    return {
      date,
      isToday: date === input.today,
      ...(row ? { row } : {}),
      availableMin,
      raw: cap.raw,
      usable: cap.usable,
      planned,
      free: Math.max(0, cap.usable - planned),
      over: Math.max(0, planned - cap.usable),
      off: availableMin === 0,
      defaultMin: defaultAvailable(input.settings, isoWeekday(date)),
      ...(window ? { window } : {}),
      ...(ownWindow ? { ownWindow: true } : {}),
      blockers,
      rows,
    };
  });
  const placed = new Set(input.assignments.map((a) => a.itemKey));
  const waiting: WaitingRow[] = input.unplaced
    .filter((u) => u.reason !== 'after-hard-due' || !placed.has(u.itemKey) || u.date === undefined)
    .filter((u) => entries.has(u.itemKey))
    .map((u) => ({
      unitId: u.id,
      itemKey: u.itemKey,
      title: titles[u.itemKey] ?? u.itemKey,
      minutes: u.minutes,
      k: u.k,
      of: u.of,
      reason: u.reason,
      ...(u.bumpedBy ? { bumpedBy: u.bumpedBy } : {}),
      ...(entries.get(u.itemKey) ? { entry: entries.get(u.itemKey) } : {}),
      ...(items.get(u.itemKey) ? { item: items.get(u.itemKey) } : {}),
    }));
  // „Nicht planen“: listed at the end of the waiting group, so „Wieder planen“ has a place.
  for (const [key, item] of items) {
    if (!item.excluded) continue;
    const entry = entries.get(key);
    if (!entry || entry.done) continue;
    waiting.push({
      unitId: `${key}#0`,
      itemKey: key,
      title: entry.title,
      minutes: item.durationMin ?? entry.durationMin ?? DEFAULT_MIN,
      k: 0,
      of: 1,
      reason: 'excluded',
      entry,
      item,
    });
  }
  const todayDay = days[0];
  const todayCount = todayDay ? new Set(todayDay.rows.map((r) => r.itemKey)).size : 0;
  return { days, waiting, todayCount };
}
