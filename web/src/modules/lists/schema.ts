import { z } from 'zod';

export const KINDS = ['shopping', 'packing', 'checklist'] as const;
export type ListKind = (typeof KINDS)[number];

/** The shopping list that always exists (fixed id: every device and the migration agree on it). */
export const SHOPPING_LIST_ID = 'shopping-default';

export const listSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(KINDS).default('checklist'),
  note: z.string().optional(),
  /** Sort key of the tab row (lower first). */
  order: z.number().default(0),
});

export const itemSchema = z.object({
  listId: z.string().min(1),
  name: z.string().min(1),
  /** Free text such as "2", "500 g" or "1 Packung". */
  quantity: z.string().optional(),
  /** Bought (shopping), packed (packing) or done (checklist). */
  done: z.boolean().default(false),
  /** Sort key inside the list (lower first). */
  order: z.number().default(0),
});

export type List = z.output<typeof listSchema>;
export type Item = z.output<typeof itemSchema>;
