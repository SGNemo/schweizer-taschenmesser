import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE } from '@/core/time/dates';

export const subscriptionSchema = z.object({
  name: z.string().min(1),
  /** Price per charge in cents. */
  amountMinor: z.number().int().min(1),
  /** How often it is charged. The rule is anchored at `startDate`. */
  recurrence: recurrenceSchema,
  /** A known charge date; the rule repeats from here. */
  startDate: z.string().regex(DATE_RE),
  /** Days before a charge by which the contract must be cancelled. */
  cancelNoticeDays: z.number().int().min(0).max(365).optional(),
  active: z.boolean().default(true),
  note: z.string().optional(),
});

export type Subscription = z.output<typeof subscriptionSchema>;
