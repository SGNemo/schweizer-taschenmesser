import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE, TIME_RE } from '@/core/time/dates';

export const reminderSchema = z.object({
  title: z.string().min(1),
  note: z.string().optional(),
  /** First occurrence, 'YYYY-MM-DD'. */
  startDate: z.string().regex(DATE_RE),
  /** Local time of day, 'HH:mm'. */
  time: z.string().regex(TIME_RE).default('09:00'),
  recurrence: recurrenceSchema.optional(),
  active: z.boolean().default(true),
});

export type Reminder = z.output<typeof reminderSchema>;
