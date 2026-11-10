import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import type { Stored } from '@/core/db/types';
import { placeSchema, type Place } from './schema';

export const placeRepo = createRepo(tableName('clock', 'place'), placeSchema);

/** More would no longer fit a calm list; the widget shows 2, 4 or 6 of them. */
export const MAX_PLACES = 12;

export type StoredPlace = Stored<Place>;

/** The live places in their order. */
export const listPlaces = (): Promise<StoredPlace[]> => placeRepo.active().sortBy('order');

/** Adds a place at the end of the list. */
export async function addPlace(label: string, zone: string): Promise<StoredPlace> {
  const all = await listPlaces();
  const order = all.reduce((max, p) => Math.max(max, p.order + 1), 0);
  return placeRepo.create({ label: label.trim(), zone, order });
}

/** Stores a new order (ids first to last); only rows whose position changed are written. */
export async function reorderPlaces(ids: readonly string[]): Promise<void> {
  const all = new Map((await listPlaces()).map((p) => [p.id, p]));
  for (const [order, id] of ids.entries()) {
    const p = all.get(id);
    if (p && p.order !== order) await placeRepo.update(id, { order });
  }
}
