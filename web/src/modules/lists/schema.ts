import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const KINDS = ['shopping', 'packing', 'checklist'] as const;
export type ListKind = (typeof KINDS)[number];

/**
 * Id of the shopping list a fresh install starts with (fixed: every device and the 0.5.0 migration agree on it).
 * Since v3 it is an ordinary list (rename, archive, delete); incoming items go to `shoppingTargetId()`.
 */
export const SHOPPING_LIST_ID = 'shopping-default';

/** Store sections of a shopping list, in the order of a typical walk through the shop. */
export const SECTIONS = [
  'produce',
  'bakery',
  'dairy',
  'meat',
  'frozen',
  'drinks',
  'household',
  'other',
] as const;
export type Section = (typeof SECTIONS)[number];

export const listSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(KINDS).default('checklist'),
  note: z.string().optional(),
  /** Sort key of the tab row (lower first). */
  order: z.number().default(0),
  /** Packing list: day of the trip 'YYYY-MM-DD' and where it goes. */
  tripDate: z.string().regex(DATE_RE).optional(),
  place: z.string().trim().max(80).optional(),
  /** v3: icon name (`LIST_ICONS`); none = the kind's icon. */
  icon: z.string().max(40).optional(),
  /** v3: index into the category palette (`categoryColor`), always shown with the name; none = no tint. */
  tone: z.number().int().min(0).max(5).optional(),
  /** v3: put away – not in the tab row, not a target for incoming items; kept with its entries. */
  archived: z.boolean().optional(),
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
  /** Shopping: part of the shop the item is found in (groups the list). */
  section: z.enum(SECTIONS).optional(),
  /** Shopping: optional price in cents (sum of the list). */
  priceCents: z.number().int().min(0).max(99_999_999).optional(),
  /** Shopping: comes back after "remove bought" instead of disappearing. */
  recurring: z.boolean().optional(),
  /** Packing: group of the entry ("Kleidung", "Technik" …), free text. */
  category: z.string().trim().max(40).optional(),
  /** Packing: still has to be bought; "Noch kaufen" sends these to the shopping list. */
  toBuy: z.boolean().optional(),
});

export type List = z.output<typeof listSchema>;
export type Item = z.output<typeof itemSchema>;
