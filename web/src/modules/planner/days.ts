/**
 * The days of the plan, built once for the run and the board: stored rows (or the weekday setting),
 * the stored blockers and the timed calendar items (`calendarBlockers`), and the day's time window
 * (its own, else the weekday's; package 5). Pure.
 */
import type { CalendarItem } from '@/core/modules/types';
import { calendarBlockers } from '@/core/plan/capacity';
import { addDays } from '@/core/plan/dates';
import { validWindow } from '@/core/plan/windows';
import type { PlanBlocker, PlanDay } from '@/core/plan/types';
import { isoWeekday } from '@/core/time/dates';
import type { PlannableEntry } from '@/core/modules/contributions';
import { itemKeyOf } from './repo';
import type { PlanDayRow, PlanItemRow } from './schema';
import { defaultAvailable, defaultWindow, type PlannerSettings } from './settings';

export type DayBlocker = PlanBlocker & {
  id: string;
  calendar: boolean;
  /** A thing taken „Als Pause“ (its item key): the blocker carries its title and length, its ⋯ takes it back. */
  breakOf?: string;
  /** A break typed in quick capture („Pause 14–16 Uhr“). */
  isBreak?: boolean;
};

/** A thing taken „Als Pause“ on a day: a blocker with its title and length. */
export interface BreakBlocker {
  date: string;
  label: string;
  min: number;
  itemKey: string;
  part?: PlanBlocker['part'];
}

/** Default length of a break without one (the row ⋯ always sets one). */
export const BREAK_DEFAULT_MIN = 60;

/**
 * The breaks of the plan (use case „Wochenende retten“, F2): every open thing whose planner row says „Als Pause“ on a
 * day becomes a blocker of that day with its title, its length and its part. A thing that is done has no break.
 */
export function breakBlockers(
  itemRows: Iterable<PlanItemRow & { id?: string }>,
  entries: readonly PlannableEntry[],
): BreakBlocker[] {
  const open = new Map(
    entries.filter((e) => !e.done).map((e) => [itemKeyOf(e.moduleId, e.id), e.title]),
  );
  const out: BreakBlocker[] = [];
  for (const r of itemRows) {
    if (!r.asBreakOn) continue;
    const key = itemKeyOf(r.source.module, r.source.id);
    const title = open.get(key);
    if (title === undefined) continue;
    out.push({
      date: r.asBreakOn,
      label: title,
      min: r.breakMin ?? BREAK_DEFAULT_MIN,
      itemKey: key,
      ...(r.part ? { part: r.part } : {}),
    });
  }
  return out.sort((a, b) => (a.itemKey < b.itemKey ? -1 : a.itemKey > b.itemKey ? 1 : 0));
}
export type BuiltDay = PlanDay & {
  row?: PlanDayRow;
  blockers: DayBlocker[];
  /** The window is the day's own (not the weekday's from the settings). */
  ownWindow?: boolean;
};

export function planDays(input: {
  today: string;
  span: number;
  settings: PlannerSettings;
  dayRows: readonly PlanDayRow[];
  calendar: readonly CalendarItem[];
  /** Things taken „Als Pause“ (`breakBlockers`). */
  breaks?: readonly BreakBlocker[];
}): BuiltDay[] {
  const rows = new Map(input.dayRows.map((r) => [r.date, r]));
  const cal = input.settings.calendarBlocks
    ? calendarBlockers(
        input.calendar.filter((c) => c.source !== 'planner'),
        { allDayBlocks: input.settings.allDayBlocks },
      )
    : [];
  return Array.from({ length: input.span }, (_, i) => {
    const date = addDays(input.today, i);
    const row = rows.get(date);
    const blockers: DayBlocker[] = [
      ...(row?.blockers ?? []).map((b) => ({
        id: b.id,
        label: b.label,
        min: b.min,
        ...times(b),
        ...(b.isBreak ? { isBreak: true } : {}),
        calendar: false,
      })),
      ...(input.breaks ?? [])
        .filter((b) => b.date === date)
        .map((b) => ({
          id: `break:${b.itemKey}`,
          label: b.label,
          min: b.min,
          ...(b.part ? { part: b.part } : {}),
          calendar: false,
          breakOf: b.itemKey,
        })),
      ...cal
        .filter((b) => b.date === date)
        .map((b) => ({ id: b.id!, label: b.label, min: b.min, ...times(b), calendar: true })),
    ];
    const own = validWindow(row);
    const window = own ?? defaultWindow(input.settings, isoWeekday(date));
    return {
      date,
      availableMin: row?.availableMin ?? defaultAvailable(input.settings, isoWeekday(date)),
      blockers,
      ...(window ? { window } : {}),
      ...(own ? { ownWindow: true } : {}),
      ...(row ? { row } : {}),
    };
  });
}

/** A blocker's `from`/`to` when both are there and in order, else nothing. */
const times = (b: { from?: string; to?: string }): { from?: string; to?: string } => {
  const w = validWindow(b);
  return w ? { from: w.from, to: w.to } : {};
};
