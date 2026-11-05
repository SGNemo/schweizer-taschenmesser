import { z } from 'zod';

/** User data of one record; the sync envelope (id, timestamps, …) is added by createRepo(). */
export const entrySchema = z.object({
  title: z.string().min(1),
  done: z.boolean().default(false),
  note: z.string().optional(),
});

export type Entry = z.output<typeof entrySchema>;
