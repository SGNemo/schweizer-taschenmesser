import { z } from 'zod';

/** A note needs a title or a body. Concurrent edits of the *same* field: the newer edit wins as a whole. */
export const noteSchema = z
  .object({
    title: z.string().default(''),
    body: z.string().default(''),
    pinned: z.boolean().default(false),
  })
  .refine((n) => n.title.trim() !== '' || n.body.trim() !== '', {
    message: 'title or body required',
    path: ['title'],
  });

export type Note = z.output<typeof noteSchema>;
