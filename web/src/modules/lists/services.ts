import { bus } from '@/core/events';
import { addItem, shoppingTargetId } from './repo';

/** Adds a requested item to the shopping list (the first one in use) once: an open item with the same name covers it. */
export async function addRequested(req: { name: string; quantity?: string }): Promise<void> {
  const text = [req.quantity?.trim(), req.name.trim()].filter(Boolean).join(' ');
  if (!text) return;
  await addItem(await shoppingTargetId(), text, 'shopping');
}

/** Runs while the lists module is enabled: reacts to `shopping.requested` (e.g. from the pantry). */
export default function start(): () => void {
  return bus.on('shopping.requested', (req) => addRequested(req));
}
