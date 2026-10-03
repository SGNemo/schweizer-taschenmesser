import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const PLACES = ['fridge', 'freezer', 'pantry', 'other'] as const;
export type Place = (typeof PLACES)[number];

/** One kind of food or household supply. */
export const itemSchema = z.object({
  name: z.string().min(1),
  place: z.enum(PLACES).default('pantry'),
  /** How many are in stock (packs, bottles …). */
  count: z.number().int().min(0).max(9999).default(1),
  /** At or below this many the item counts as "running low". */
  minCount: z.number().int().min(0).max(9999).optional(),
  /** Best-before date 'YYYY-MM-DD'. */
  expires: z.string().regex(DATE_RE).optional(),
  note: z.string().optional(),
});

export type PantryItem = z.output<typeof itemSchema>;
