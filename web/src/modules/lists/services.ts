import { addLinkIfAbsent } from '@/core/entitylinks';
import { bus } from '@/core/events';
import type { EventMap } from '@/core/events/events';
import { addItem, ensureShoppingList, itemsOf } from './repo';
import { parseEntry } from './logic';
import { SHOPPING_LIST_ID } from './schema';

/**
 * Adds a requested item to the shopping list once: an open item with the same name covers it. With `ref` (the
 * pantry entry that asked) the open entry of that name gets a link back to it (`_links`, entry → asker), so the
 * pantry can say „Auf der Einkaufsliste“ and the entry leads back. A ref that cannot be linked is ignored.
 */
export async function addRequested(req: EventMap['shopping.requested']): Promise<void> {
  const text = [req.quantity?.trim(), req.name.trim()].filter(Boolean).join(' ');
  if (!text) return;
  await ensureShoppingList();
  await addItem(SHOPPING_LIST_ID, text, 'shopping');
  if (!req.ref) return;
  const name = parseEntry(text).name.trim().toLowerCase();
  const entry = (await itemsOf(SHOPPING_LIST_ID)).find(
    (i) => !i.done && i.name.trim().toLowerCase() === name,
  );
  if (!entry) return;
  await addLinkIfAbsent({
    from: { module: 'lists', id: entry.id },
    to: req.ref,
    rel: 'origin',
    label: req.name.trim(),
  }).catch(() => false);
}

/** Runs while the lists module is enabled: reacts to `shopping.requested` (e.g. from the pantry). */
export default function start(): () => void {
  return bus.on('shopping.requested', (req) => addRequested(req));
}
