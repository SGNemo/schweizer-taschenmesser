import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

/**
 * Recurrence rule. The first occurrence is defined by a separate start date.
 * Weekdays are ISO (Mon = 1 … Sun = 7); `byMonthDay: -1` means "last day of the month".
 */
export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(999).default(1),
  byWeekday: z.array(z.number().int().min(1).max(7)).optional(),
  byMonthDay: z
    .number()
    .int()
    .refine((n) => n === -1 || (n >= 1 && n <= 31), 'must be 1–31 or -1')
    .optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  until: z.string().regex(DATE_RE).optional(),
  count: z.number().int().min(1).max(9999).optional(),
});

export type Recurrence = z.output<typeof recurrenceSchema>;
