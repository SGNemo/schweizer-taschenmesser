import { ensureShoppingList } from './repo';
import { SHOPPING_LIST_ID } from './schema';

/** Entries created by the assistant land on the shopping list. */
export default async function defaults(collection: string): Promise<Record<string, unknown>> {
  if (collection !== 'item') return {};
  await ensureShoppingList();
  return { listId: SHOPPING_LIST_ID };
}
