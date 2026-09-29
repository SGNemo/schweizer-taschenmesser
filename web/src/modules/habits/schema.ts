import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export const habitSchema = z.object({
  name: z.string().min(1),
  /** ISO weekdays (1 = Monday) on which the habit is due; default every day. */
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).default(ALL_DAYS),
  archived: z.boolean().default(false),
});

/** One record per habit and day; the id is `<habitId>:<date>` so devices converge on the same record. */
export const checkSchema = z.object({
  habitId: z.string().min(1),
  date: z.string().regex(DATE_RE),
});

export type Habit = z.output<typeof habitSchema>;
export type Check = z.output<typeof checkSchema>;
