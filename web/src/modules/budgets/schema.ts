import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

/** How long one budget period is (since version 3). */
export const BUDGET_PERIODS = ['month', 'quarter', 'year'] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

/**
 * Spending limit for one finance category (the category lives in the finance module). The limit
 * applies to one `period` (a month unless set): the field keeps its name from when it was monthly only.
 */
export const budgetSchema = z.object({
  categoryId: z.string().min(1),
  monthlyLimitMinor: z.number().int().min(1),
  period: z.enum(BUDGET_PERIODS).optional(),
  /** What was left (or overspent) of the previous period moves into this one. */
  carryOver: z.boolean().optional(),
  /** Percent of the limit from which the budget is shown as "nearly used" (default from the settings). */
  warnAtPercent: z.number().int().min(10).max(99).optional(),
  /** ISO 4217 code of the amount; none means euro (since version 2). */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .meta({ description: 'ISO 4217, z. B. EUR, USD, MXN; ohne Angabe EUR' }),
});

export const goalSchema = z.object({
  name: z.string().min(1),
  targetMinor: z.number().int().min(1),
  /** ISO 4217 code of the amount; none means euro (since version 2). */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .meta({ description: 'ISO 4217, z. B. EUR, USD, MXN; ohne Angabe EUR' }),
  deadline: z.string().regex(DATE_RE).optional(),
  /** What the user plans to put aside per month (since version 3); the plan says when the goal is reached. */
  monthlyRateMinor: z.number().int().min(1).optional(),
  /** When the saving started (since version 4); with it the goal shows the average put aside so far. */
  startDate: z.string().regex(DATE_RE).optional(),
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
