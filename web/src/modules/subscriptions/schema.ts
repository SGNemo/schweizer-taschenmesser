import { z } from 'zod';
import { recurrenceSchema } from '@/core/recurrence/types';
import { DATE_RE } from '@/core/time/dates';

/** One price change: the price was `fromMinor` until `date`, `toMinor` from then on. */
export const priceChangeSchema = z.object({
  date: z.string().regex(DATE_RE),
  fromMinor: z.number().int().min(1),
  toMinor: z.number().int().min(1),
});
export type PriceChange = z.output<typeof priceChangeSchema>;

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
  /** Earlier prices, oldest first (since version 2); the current price is `amountMinor`. */
  priceHistory: z.array(priceChangeSchema).max(20).optional().meta({ internal: true }),
});

export type Subscription = z.output<typeof subscriptionSchema>;
