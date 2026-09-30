import { z } from 'zod';

export const listSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
});

export const itemSchema = z.object({
  listId: z.string().min(1),
  name: z.string().min(1),
  packed: z.boolean().default(false),
  order: z.number().default(0),
});

export type PackingList = z.output<typeof listSchema>;
export type PackingItem = z.output<typeof itemSchema>;
