/**
 * The days of the plan, built once for the run and the board: stored rows (or the weekday setting),
 * the stored blockers, the timed calendar items (`calendarBlockers`), the blocks modules keep free
 * (`PlannableSource.blocks`, planner hub S4) and the day's time window (its own, else the weekday's;
 * package 5). Pure.
 */
import type { PlanBlockEntry, PlannableEntry } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { calendarBlockers, type BlockerRef } from '@/core/plan/capacity';
import { addDays } from '@/core/plan/dates';
import { validWindow } from '@/core/plan/windows';
import type { PlanBlocker, PlanDay, PlanItem } from '@/core/plan/types';
import { isoWeekday } from '@/core/time/dates';
import type { PlanDayRow } from './schema';
import { defaultAvailable, defaultWindow, type PlannerSettings } from './settings';

export type DayBlocker = PlanBlocker & {
  id: string;
  calendar: boolean;
  /** A module keeps this time free (a habit, S4): the module that asked; no time, no remove, no tick. */
  module?: string;
  /** A calendar appointment that is a link target (package 9): its row opens, things link `before` / `after` it. */
  ref?: BlockerRef;
};
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
  /** Blocks of time modules keep free; missing = none. */
  blocks?: readonly PlanBlockEntry[];
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
        .map((b) => ({
          id: b.id!,
          label: b.label,
          min: b.min,
          ...times(b),
          calendar: true,
          ...(b.ref ? { ref: b.ref } : {}),
        })),
      // A module's block takes time like an appointment, without a time of its own (habits do not say when).
      ...(input.blocks ?? [])
        .filter((b) => b.date === date)
        .map((b) => ({
          id: `${b.moduleId}:${b.id}`,
          label: b.label,
          min: b.min,
          calendar: false,
          module: b.moduleId,
        })),
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

/**
 * A source's fixed window (planner hub S4, a training at 18:00) on the thing's day: `plannedFor`, else `earliest`.
 * Without a day it is no fixed block (the thing is planned as before).
 */
export function fixedOf(
  e: Pick<PlannableEntry, 'fixed' | 'plannedFor' | 'earliest'>,
): PlanItem['fixed'] {
  const date = e.plannedFor ?? e.earliest;
  if (!e.fixed || !date) return undefined;
  return { date, from: e.fixed.from, ...(e.fixed.to ? { to: e.fixed.to } : {}) };
}

/**
 * The day of a source's dated turn shown without a row (planner rethink, `PlannableItem.day`): open, not a fixed block
 * (that has its row), not laid (a row wins), not taken out („Nicht planen“) and not late money. The one predicate for
 * the board, the proposer and the toasts, so they all count the same time on that day.
 */
export function turnDayOf(
  e: Pick<PlannableEntry, 'day' | 'done' | 'fixed' | 'plannedFor' | 'earliest'>,
  facts: { laid: boolean; excluded: boolean; late: boolean },
): string | undefined {
  if (!e.day || e.done || fixedOf(e) || facts.laid || facts.excluded || facts.late)
    return undefined;
  return e.day;
}
