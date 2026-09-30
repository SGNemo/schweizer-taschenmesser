import { z } from 'zod';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const STATUSES = ['idea', 'bought', 'given'] as const;
export type Status = (typeof STATUSES)[number];

/** A gift idea for someone. Private on purpose: the assistant gets no schema for it (surprises). */
export const ideaSchema = z.object({
  title: z.string().min(1),
  forWhom: z.string().min(1),
  occasion: z.string().optional(),
  /** Day of the occasion, 'YYYY-MM-DD'. */
  date: z.string().regex(DATE).optional(),
  /** Price in cents. */
  priceCents: z.number().int().min(0).optional(),
  url: z.string().optional(),
  status: z.enum(STATUSES).default('idea'),
  note: z.string().optional(),
});

export type Idea = z.output<typeof ideaSchema>;
