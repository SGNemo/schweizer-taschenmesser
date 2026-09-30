import { z } from 'zod';
import { normalizeLaunchUrl } from './logic';

/** One launcher tile. `url` is normalised on write, so stored links are always launchable. */
export const linkSchema = z.object({
  title: z.string().trim().min(1),
  url: z
    .string()
    .refine((u) => normalizeLaunchUrl(u) !== undefined, { message: 'not a launchable address' })
    .transform((u) => normalizeLaunchUrl(u)!),
  group: z.string().trim().optional(),
});

export type Link = z.output<typeof linkSchema>;
