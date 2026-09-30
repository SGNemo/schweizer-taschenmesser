import { bus } from '@/core/events';
import { isDuplicate } from './logic';
import { itemRepo } from './repo';

/** Adds a requested item once: an open item with the same name already covers it. */
export async function addRequested(req: { name: string; quantity?: string }): Promise<void> {
  const name = req.name.trim();
  if (!name) return;
  if (isDuplicate(await itemRepo.active().toArray(), name)) return;
  await itemRepo.create({ name, quantity: req.quantity?.trim() || undefined, done: false });
}

/** Runs while the shopping module is enabled: reacts to `shopping.requested`. */
export default function start(): () => void {
  return bus.on('shopping.requested', (req) => addRequested(req));
}
