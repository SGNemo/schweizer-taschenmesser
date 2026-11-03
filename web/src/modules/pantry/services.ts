import { bus } from '@/core/events';
import { itemRepo } from './repo';

/** "2" counts as two, anything else ("500 g", "1 Packung") as one piece: the pantry counts pieces. */
export const piecesOf = (quantity?: string): number => {
  const m = /^\s*(\d{1,4})\s*$/.exec(quantity ?? '');
  return m ? Math.max(1, Number(m[1])) : 1;
};

/** Adds bought goods to the stock: the item of that name gets more, an unknown name becomes a new item. */
export async function restock(req: { name: string; quantity?: string }): Promise<void> {
  const name = req.name.trim();
  if (!name) return;
  const n = piecesOf(req.quantity);
  const key = name.toLowerCase();
  const existing = (await itemRepo.active().toArray()).find(
    (i) => i.name.trim().toLowerCase() === key,
  );
  if (existing) await itemRepo.update(existing.id, { count: Math.min(9999, existing.count + n) });
  else await itemRepo.create({ name, place: 'pantry', count: n });
}

/** Runs while the pantry module is enabled: reacts to `pantry.restock` (from the shopping list). */
export default function start(): () => void {
  return bus.on('pantry.restock', (req) => restock(req));
}
