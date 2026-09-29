import { z } from 'zod';

export const itemSchema = z.object({
  name: z.string().min(1),
  /** Free text such as "2", "500 g" or "1 Packung". */
  quantity: z.string().optional(),
  done: z.boolean().default(false),
});

export type ShoppingItem = z.output<typeof itemSchema>;
