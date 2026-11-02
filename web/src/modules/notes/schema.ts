import { z } from 'zod';

/** A note needs a title or a body. Concurrent edits of the *same* field: the newer edit wins as a whole. */
export const noteSchema = z
  .object({
    title: z.string().default(''),
    body: z.string().default(''),
    pinned: z.boolean().default(false),
    /** Notebook (category); `null` = "Allgemein" (no notebook). The scratch pad never belongs to one. */
    notebookId: z.string().nullable().default(null),
    /** Position for the manual sort order (lower first). */
    order: z.number().default(0),
  })
  .refine((n) => n.title.trim() !== '' || n.body.trim() !== '', {
    message: 'title or body required',
    path: ['title'],
  });

export type Note = z.output<typeof noteSchema>;

/** A notebook (category) with a colour and an icon; pages live inside. */
export const notebookSchema = z.object({
  name: z.string().trim().min(1),
  /** Index into the fixed category palette (`categoryColor`); always shown together with the name. */
  tone: z.number().int().min(0).max(5).default(0),
  icon: z.string().default('note'),
  order: z.number().default(0),
});

export type Notebook = z.output<typeof notebookSchema>;
