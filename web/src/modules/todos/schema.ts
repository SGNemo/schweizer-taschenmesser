import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE } from '@/core/time/dates';

export const listSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  order: z.number().default(0),
});

export const taskSchema = z.object({
  listId: z.string().min(1),
  title: z.string().min(1),
  done: z.boolean().default(false),
  /** 0 = none, 1 = low, 2 = medium, 3 = high. */
  priority: z
    .number()
    .int()
    .min(0)
    .max(3)
    .default(0)
    .meta({ description: '0 = keine, 1 = niedrig, 2 = mittel, 3 = hoch' }),
  dueDate: z.string().regex(DATE_RE).optional(),
  /** Repeats from `dueDate`: ticking it off creates the next one (see `completeTask`). */
  recurrence: recurrenceSchema.optional(),
  /** "Irgendwann": kept out of the open views, the widget and the calendar. */
  someday: z.boolean().optional(),
  /** The day the user plans to do it (the "Heute" plan); independent of the due date. */
  plannedFor: z.string().regex(DATE_RE).optional(),
  /** Estimated effort in minutes (5, 15, 30, 60 offered); shown as "etwa 10 Min". */
  estimateMin: z.number().int().min(1).max(480).optional(),
  /** Set for subtasks (one level only). */
  parentId: z.string().optional(),
  note: z.string().optional(),
  order: z.number().default(0),
  completedAt: z.number().optional().meta({ internal: true }),
});

export type TodoList = z.output<typeof listSchema>;
export type Task = z.output<typeof taskSchema>;
