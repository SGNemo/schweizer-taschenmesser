import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const birthdaySchema = z
  .object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    /** Unknown for many entries; without it no age is shown. */
    year: z.number().int().min(1850).max(2200).optional(),
  })
  .refine((b) => b.day <= DAYS_IN_MONTH[b.month - 1]!, {
    message: 'day does not exist in that month',
    path: ['day'],
  });

export type Birthday = z.output<typeof birthdaySchema>;

/** A person: birthday (repeats every year) and the gifts for them live in `gift`. */
export const personSchema = z.object({
  name: z.string().min(1),
  birthday: birthdaySchema.optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type Person = z.output<typeof personSchema>;

export const GIFT_STATUSES = ['idea', 'bought', 'given'] as const;
export type GiftStatus = (typeof GIFT_STATUSES)[number];

/**
 * A gift (idea) for a person. Private on purpose: `people` offers the assistant `person` only,
 * never `gift` (surprises).
 */
export const giftSchema = z.object({
  personId: z.string().min(1),
  title: z.string().min(1),
  occasion: z.string().optional(),
  /** Day of the occasion, 'YYYY-MM-DD'. */
  date: z.string().regex(DATE_RE).optional(),
  /** Price in cents. */
  priceCents: z.number().int().min(0).optional(),
  url: z.string().optional(),
  status: z.enum(GIFT_STATUSES).default('idea'),
  note: z.string().optional(),
});

export type Gift = z.output<typeof giftSchema>;
