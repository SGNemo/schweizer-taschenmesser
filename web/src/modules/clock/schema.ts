import { z } from 'zod';
import { isKnownZone } from '@/core/time/zones';

/** One place whose time is shown: the person's own name for it and the IANA zone. The envelope is added by createRepo(). */
export const placeSchema = z.object({
  label: z.string().trim().min(1).max(60),
  zone: z.string().min(1).max(64).refine(isKnownZone, 'unknown time zone'),
  /** Position in the list and on the widget; lower first. Internal (the data API leaves it out): imports start at 0. */
  order: z.number().int().min(0).default(0),
});

export type Place = z.output<typeof placeSchema>;
