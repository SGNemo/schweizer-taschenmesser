import { z } from 'zod';

export const KINDS = ['link', 'read', 'watch', 'place', 'idea', 'other'] as const;
export type Kind = (typeof KINDS)[number];

export const itemSchema = z.object({
  title: z.string().min(1),
  /** http(s) address, normalised by `normalizeUrl`. */
  url: z.string().optional(),
  kind: z.enum(KINDS).default('link'),
  tags: z.array(z.string().min(1)).default([]),
  note: z.string().optional(),
  done: z.boolean().default(false),
});

export type BookmarkItem = z.output<typeof itemSchema>;
