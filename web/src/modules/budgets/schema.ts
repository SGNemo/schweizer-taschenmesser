import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

/** Monthly spending limit for one finance category (the category lives in the finance module). */
export const budgetSchema = z.object({
  categoryId: z.string().min(1),
  monthlyLimitMinor: z.number().int().min(1),
});

export const goalSchema = z.object({
  name: z.string().min(1),
  targetMinor: z.number().int().min(1),
  deadline: z.string().regex(DATE_RE).optional(),
  note: z.string().optional(),
});

/** Money put aside (positive) or taken out (negative). The saved amount is the sum of deposits. */
export const depositSchema = z.object({
  goalId: z.string().min(1),
  amountMinor: z
    .number()
    .int()
    .refine((n) => n !== 0, 'amount must not be zero'),
  date: z.string().regex(DATE_RE),
  note: z.string().optional(),
});

export type Budget = z.output<typeof budgetSchema>;
export type Goal = z.output<typeof goalSchema>;
export type Deposit = z.output<typeof depositSchema>;
