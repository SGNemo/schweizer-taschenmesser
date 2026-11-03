import { z } from 'zod';

export const KINDS = ['link', 'read', 'watch', 'book', 'place', 'idea', 'other'] as const;
export type Kind = (typeof KINDS)[number];

export const itemSchema = z.object({
  title: z.string().min(1),
  /** http(s) address, normalised by `normalizeUrl`. */
  url: z.string().optional(),
  kind: z.enum(KINDS).default('link'),
  tags: z.array(z.string().min(1)).default([]),
  note: z.string().optional(),
  done: z.boolean().default(false),
  /** Status "Angefangen" between open and done; `done` wins when both are set. */
  started: z.boolean().default(false),
  /** What the page said about itself (link preview, only when the setting is on); the picture lives in `_blobs`. */
  preview: z
    .object({
      site: z.string().optional(),
      description: z.string().optional(),
      image: z.boolean().optional(),
    })
    .optional(),
});

export type BookmarkItem = z.output<typeof itemSchema>;
