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
import type { PlanDayRow } from './schema';
import { defaultAvailable, defaultWindow, type PlannerSettings } from './settings';

export type DayBlocker = PlanBlocker & { id: string; calendar: boolean };
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
        calendar: false,
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
