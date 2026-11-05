import { z } from 'zod';
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
});

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
  due: z.object({ date: z.string().regex(DATE_RE), hard: z.boolean() }).optional(),
  /** The user's own date (a ToDo's `plannedFor` before the first overwrite); read as "not before". */
  earliest: z.string().regex(DATE_RE).optional(),
  /** Nailed to a day („Festnageln“). */
  pinned: z.string().regex(DATE_RE).optional(),
  splittable: z.boolean().optional(),
  /** „Nicht planen“. */
  excluded: z.boolean().optional(),
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
  bumpedBy: z.array(z.string()).optional(),
  late: z.boolean().optional(),
});

export type PlanBlockerRow = z.output<typeof blockerSchema>;
export type PlanDayRow = z.output<typeof daySchema>;
export type PlanItemRow = z.output<typeof itemSchema>;
export type AssignmentRow = z.output<typeof assignmentSchema>;
