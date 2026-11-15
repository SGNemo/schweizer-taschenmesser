import { shoppingTargetId } from './repo';

/** Entries created by the assistant land on the shopping list (the first one in use). */
export default async function defaults(collection: string): Promise<Record<string, unknown>> {
  if (collection !== 'item') return {};
  return { listId: await shoppingTargetId() };
}
