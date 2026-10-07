import { bus } from '@/core/events';
import { addItem, ensureShoppingList } from './repo';
import { SHOPPING_LIST_ID } from './schema';

/** Adds a requested item to the shopping list once: an open item with the same name covers it. */
export async function addRequested(req: { name: string; quantity?: string }): Promise<void> {
  const text = [req.quantity?.trim(), req.name.trim()].filter(Boolean).join(' ');
  if (!text) return;
  await ensureShoppingList();
  await addItem(SHOPPING_LIST_ID, text, 'shopping');
}

/** Runs while the lists module is enabled: reacts to `shopping.requested` (e.g. from the pantry). */
export default function start(): () => void {
  return bus.on('shopping.requested', (req) => addRequested(req));
}
