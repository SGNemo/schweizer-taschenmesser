import { z } from 'zod';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

/**
 * Habits (new in the Planen group; not the retired module of 0.4: new collections `habits_goal` and
 * `habits_entry`, so no old table or device op can collide).
 *
 * A goal is "yes/no" (done or not) or a number ("8 Gläser"). It is scheduled every day, on chosen
 * weekdays, or "x times a week". An entry is one day of one goal; a rest day (`skipped`) is neither
 * done nor missed and never counts against anything.
 */
export const GOAL_KINDS = ['yesno', 'count'] as const;
export const GOAL_PERIODS = ['day', 'week'] as const;

/** A reminder at one time, or every `everyMin` minutes inside a window (until the day's goal is met). */
export const reminderSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('time'), time: z.string().regex(TIME_RE) }),
  z.object({
    kind: z.literal('window'),
    from: z.string().regex(TIME_RE),
    to: z.string().regex(TIME_RE),
    everyMin: z.number().int().min(15).max(480),
  }),
]);
export type Reminder = z.output<typeof reminderSchema>;

export const goalSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(GOAL_KINDS).default('yesno'),
  /** Per day (count goals; 1 for yes/no). */
  target: z.number().int().min(1).max(1000).default(1),
  /** "Gläser", "Seiten", "Min": shown after the number of a count goal. */
  unit: z.string().optional(),
  period: z.enum(GOAL_PERIODS).default('day'),
  /** ISO weekdays 1–7 the goal is scheduled on (period `day`); empty or missing = every day. */
  weekdays: z.array(z.number().int().min(1).max(7)).optional(),
  /** Times per week (period `week`). */
  weeklyTimes: z.number().int().min(1).max(7).default(3),
  reminder: reminderSchema.optional(),
  order: z.number().default(0),
  /** Out of sight but kept (and exportable) – nothing is deleted by archiving. */
  archived: z.boolean().optional(),
});
export type Goal = z.output<typeof goalSchema>;

export const entrySchema = z.object({
  goalId: z.string().min(1),
  /** Local day, YYYY-MM-DD. */
  date: z.string().regex(DATE_RE),
  /** How much was done that day (1 = done for a yes/no goal). */
  count: z.number().int().min(0).max(100000).default(0),
  /** A rest day: counts neither for nor against. */
  skipped: z.boolean().optional(),
});
export type Entry = z.output<typeof entrySchema>;
