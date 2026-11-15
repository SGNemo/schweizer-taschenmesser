import { bus } from '@/core/events';
import type { EventMap } from '@/core/events';
import { getSettings } from '@/core/settings/settings';
import { today } from '@/core/time/now';
import { expiryState, needsRestock } from './logic';
import { itemRepo } from './repo';
import { settings, settingsSchema } from './settings';

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

type Need = Parameters<EventMap['pantry.needsRequested']['answer']>[0][number];

/** What should go on the shopping list: used up or at the minimum first, then expired, then expiring soon. */
export async function currentNeeds(day = today()): Promise<Need[]> {
  const prefs = await getSettings('module.pantry', settingsSchema, settings.defaults as never);
  const soonDays = (prefs as { soonDays?: number }).soonDays ?? 3;
  // By name inside each group: the same answer on every device and every time.
  const items = (await itemRepo.active().toArray()).sort((a, b) => a.name.localeCompare(b.name));
  const needs: Need[] = [];
  const seen = new Set<string>();
  const push = (name: string, reason: Need['reason']) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    needs.push({ name: name.trim(), reason });
  };
  for (const i of items) if (needsRestock(i)) push(i.name, i.count === 0 ? 'empty' : 'low');
  for (const i of items) if (expiryState(i, day, soonDays) === 'expired') push(i.name, 'expired');
  for (const i of items) if (expiryState(i, day, soonDays) === 'soon') push(i.name, 'soon');
  return needs;
}

/**
 * Runs while the pantry module is enabled: reacts to `pantry.restock` (from the shopping list) and answers
 * `pantry.needsRequested` ("Aus Vorräten auffüllen" on a shopping list).
 */
export default function start(): () => void {
  const offRestock = bus.on('pantry.restock', (req) => restock(req));
  const offNeeds = bus.on('pantry.needsRequested', async (req) => req.answer(await currentNeeds()));
  return () => {
    offRestock();
    offNeeds();
  };
}
