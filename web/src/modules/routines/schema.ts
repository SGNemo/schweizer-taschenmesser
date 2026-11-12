import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE } from '@/core/time/dates';

/**
 * A household routine ("Bad putzen", every two weeks, in turns). The rule and its anchor day say when it comes
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
});

export type Routine = z.output<typeof routineSchema>;
export type RoutineInput = z.input<typeof routineSchema>;
