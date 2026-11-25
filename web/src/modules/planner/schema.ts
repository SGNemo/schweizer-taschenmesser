import { z } from 'zod';
import type { DayPart } from '@/core/plan/types';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

/**
 * The planner's three synced collections (docs/design/plan/CONCEPT.md §2). Ids are deterministic and
 * written through `putRow` (`repo.ts`): a day is its date, an item `<module>:<id>`, a session
 * `<itemKey>#<k>`. Plain indexes only, no unique ones: two devices that touch the same day offline
 * must merge, not collide. The module sets `dataApi: false`: the plan describes the user's days.
 */

/** A stretch of a day that is not available (an appointment the user typed, a workshop); `from`/`to` are optional windows (package 5). */
export const blockerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  min: z.number().int().min(0).max(1440),
  from: z.string().regex(TIME_RE).optional(),
  to: z.string().regex(TIME_RE).optional(),
});

/** Only days the user touched are stored; a missing day = the weekday default of the settings. */
export const daySchema = z.object({
  date: z.string().regex(DATE_RE),
  /** Minutes for planned work (0 = a day off). Missing = the weekday default. */
  availableMin: z.number().int().min(0).max(1440).optional(),
  blockers: z.array(blockerSchema).default([]),
  note: z.string().optional(),
  /** The day's own time window (package 5, `core/plan/windows.ts`); missing = the weekday window of the settings, if any. */
  from: z.string().regex(TIME_RE).optional(),
  to: z.string().regex(TIME_RE).optional(),
});

/** The day parts a row may carry (`core/plan/types.ts` `DayPart`). */
export const DAY_PARTS_ENUM = [
  'morning',
  'afternoon',
  'evening',
] as const satisfies readonly DayPart[];

export const PLAN_PRIORITIES = [0, 1, 2, 3] as const;

/**
 * One planned thing: only what the source does not have (pin, split, exclusion, a hard due marked in
 * the plan, the user's own date before the planner overwrote it). `title` stays empty in v1.
 */
export const itemSchema = z.object({
  source: z.object({ module: z.string().min(1), id: z.string().min(1) }),
  title: z.string().optional(),
  durationMin: z.number().int().min(1).max(1440).optional(),
  priority: z.number().int().min(0).max(3).optional(),
  /** A deadline; `time` ('HH:mm') is its hour („Frist So 18:00“, package 5b): shown, never planned by. */
  due: z
    .object({
      date: z.string().regex(DATE_RE),
      hard: z.boolean(),
      time: z.string().regex(TIME_RE).optional(),
    })
    .optional(),
  /** The user's own date (a ToDo's `plannedFor` before the first overwrite); read as "not before". */
  earliest: z.string().regex(DATE_RE).optional(),
  /** Nailed to a day („Festnageln“). */
  pinned: z.string().regex(DATE_RE).optional(),
  splittable: z.boolean().optional(),
  /** „Nicht planen“. */
  excluded: z.boolean().optional(),
  /** Tagesabschnitt (package 4b): orders the thing inside its day and, with a window, where it sits; never its day. */
  part: z.enum(DAY_PARTS_ENUM).optional(),
  /**
   * „Weglassen“ of a training whose day has passed unlogged (`passed.ts`, v5): that day. Today's page no longer asks
   * for it; a session moved to another day asks again. Never read by the run.
   */
  skipped: z.string().regex(DATE_RE).optional(),
  /**
   * `durationMin` came from measured time (v7, package 8): a new thing without minutes took the median of its last
   * records. The row says Z1 „20 Min · wie zuletzt“ until its minutes are set by hand („Dauer …“ clears both).
   */
  measured: z.boolean().optional(),
  order: z.number().default(0),
});

export const ASSIGNMENT_REASONS = [
  'pinned',
  'deadline',
  'deadline-buffer',
  'new',
  'kept',
  'carried',
  'pulled',
  'bumped',
  'after-part',
  'capacity',
] as const;

/** Session `k` of `of` of an item on a day; id `<itemKey>#<k>`, so two devices write the same rows. */
export const assignmentSchema = z.object({
  itemKey: z.string().min(1),
  k: z.number().int().min(0),
  of: z.number().int().min(1),
  date: z.string().regex(DATE_RE),
  minutes: z.number().int().min(0),
  order: z.number().int().min(0),
  reason: z.enum(ASSIGNMENT_REASONS),
  /**
   * „fest“ (v6, planner rethink): the thing must be on this day. No proposal ever takes it („Rest verteilen“, „Neu
   * verteilen“); the person may still move it by hand, the lock goes with it. Day and lock live in this one row.
   */
  locked: z.boolean().optional(),
  bumpedBy: z.array(z.string()).optional(),
  late: z.boolean().optional(),
  /** Start and end inside the day's window (package 5); missing without a window or when the session does not fit. */
  from: z.string().regex(TIME_RE).optional(),
  to: z.string().regex(TIME_RE).optional(),
});

/**
 * The length the plan works with: its own row's over the source's – except a measured one (package 8), which only stood
 * in for a missing estimate and gives way as soon as the source has one (set in ToDos, say).
 */
export function planLength(
  row: Pick<PlanItemRow, 'durationMin' | 'measured'> | undefined,
  source: number | undefined,
): number | undefined {
  if (row?.measured && source !== undefined) return source;
  return row?.durationMin ?? source;
}

/** Longest record (8 h): a timer left running teaches nothing. */
export const MEASURE_MAX_MIN = 480;

/**
 * One measured duration (package 8, CONCEPT-ROWS idea 8): the minutes a focus round or a „Los“ step ran, pauses
 * removed. `key` names „the same thing“ (`measure.ts measureKey`), `on` the day it was recorded. At most five per key –
 * pruned inside the recording action. Synced between his own devices like the plan; never exported, copied, offered to
 * the data API, an assistant or a diagnosis.
 */
/** Longest key: a longer title is compared by its beginning (`measure.ts capped`). */
export const MEASURE_KEY_MAX = 240;

export const measureSchema = z.object({
  key: z.string().min(1).max(MEASURE_KEY_MAX),
  minutes: z.number().int().min(1).max(MEASURE_MAX_MIN),
  on: z.string().regex(DATE_RE),
});

export type PlanBlockerRow = z.output<typeof blockerSchema>;
export type PlanDayRow = z.output<typeof daySchema>;
export type PlanItemRow = z.output<typeof itemSchema>;
export type AssignmentRow = z.output<typeof assignmentSchema>;
export type MeasureRow = z.output<typeof measureSchema>;
