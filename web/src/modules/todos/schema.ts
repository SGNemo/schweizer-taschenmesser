import { z } from 'zod';
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
  priority: z.number().int().min(0).max(3).default(0),
  dueDate: z.string().regex(DATE_RE).optional(),
  /** Set for subtasks (one level only). */
  parentId: z.string().optional(),
  note: z.string().optional(),
  order: z.number().default(0),
  completedAt: z.number().optional(),
});

export type TodoList = z.output<typeof listSchema>;
export type Task = z.output<typeof taskSchema>;
