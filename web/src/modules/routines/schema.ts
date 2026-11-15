import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE } from '@/core/time/dates';

/** One step of a routine („Zähne putzen“). The id keeps a tick on the step while its text is corrected. */
export const stepSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(200),
});

/** When in the day a routine is done; none = any time. */
export const DAYPARTS = ['morning', 'midday', 'evening'] as const;
export type Daypart = (typeof DAYPARTS)[number];

/**
 * A routine: a household chore („Bad putzen“, every two weeks, in turns) or a sequence of steps („Morgenroutine“,
 * every day in the morning). A household routine ("Bad putzen", every two weeks, in turns). The rule and its anchor day say when it comes
 * round; `dueDate` is the next day it is someone's turn. The names of the rotation are free text typed here: no
 * other module is read for them.
 */
export const routineSchema = z.object({
  name: z.string().min(1).max(120),
  room: z.string().max(60).optional(),
  repeat: recurrenceSchema,
  /** The day the rule counts from (its first turn). */
  startDate: z.string().regex(DATE_RE),
  /** The next day it is due; moved on by "Erledigt". */
  dueDate: z.string().regex(DATE_RE),
  /** Who takes turns, in order; empty = nobody is named. */
  people: z.array(z.string().min(1).max(40)).max(12).default([]),
  /** Index into `people` of whoever is next. */
  turn: z.number().int().min(0).default(0),
  lastDoneOn: z.string().regex(DATE_RE).optional(),
  lastDoneBy: z.string().max(40).optional(),
  /** How long it takes, for the planner (whole minutes). */
  minutes: z.number().int().min(1).max(1440).optional(),
  note: z.string().max(2000).optional(),
  /**
   * The small steps, in order; none or empty = the routine is one thing (a chore). Since version 2; read through
   * `stepsOf` (a row from a device that has not updated yet has none).
   */
  steps: z.array(stepSchema).max(40).optional(),
  /** Morning, midday or evening; none = any time of the day. Since version 2. */
  daypart: z.enum(DAYPARTS).optional(),
  /**
   * The steps ticked for the turn due on `day`. A tick for another turn is simply ignored: the next turn starts
   * with nothing ticked, without a write. Since version 2.
   */
  progress: z
    .object({ day: z.string().regex(DATE_RE), done: z.array(z.string().min(1).max(40)).max(40) })
    .optional(),
});

export type Step = z.output<typeof stepSchema>;

export type Routine = z.output<typeof routineSchema>;
export type RoutineInput = z.input<typeof routineSchema>;
