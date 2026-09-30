import { z } from 'zod';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const birthdaySchema = z
  .object({
    name: z.string().min(1),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    /** Unknown for many entries; without it no age is shown. */
    year: z.number().int().min(1850).max(2200).optional(),
    note: z.string().optional(),
  })
  .refine((b) => b.day <= DAYS_IN_MONTH[b.month - 1]!, {
    message: 'day does not exist in that month',
    path: ['day'],
  });

export type Birthday = z.output<typeof birthdaySchema>;
