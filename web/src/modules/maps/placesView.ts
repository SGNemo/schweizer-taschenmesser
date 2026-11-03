import type { Place } from './schema';

export type PlaceSort = 'recent' | 'name';

type P = Pick<Place, 'name' | 'address' | 'note' | 'category' | 'pinned'> & {
  createdAt: number;
};

/** Words of `query` (split on spaces) must all appear in the name, address or note (case-insensitive). */
export function matchesQuery(p: Pick<P, 'name' | 'address' | 'note'>, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${p.name} ${p.address ?? ''} ${p.note ?? ''}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

/**
 * The list of the places tab: filtered by category and search words, pinned first, then newest
 * first ("recent") or by name. Pure; the page keeps the choices in its state.
 */
export function viewPlaces<T extends P>(
  places: readonly T[],
  opts: { category?: Place['category'] | 'all'; query?: string; sort?: PlaceSort },
): T[] {
  const { category = 'all', query = '', sort = 'recent' } = opts;
  return places
    .filter((p) => (category === 'all' || p.category === category) && matchesQuery(p, query))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return sort === 'name'
        ? a.name.localeCompare(b.name)
        : b.createdAt - a.createdAt || a.name.localeCompare(b.name);
    });
}

/** The place that was saved last (the head names it). */
export function lastPlace<T extends { createdAt: number }>(places: readonly T[]): T | undefined {
  return places.reduce<T | undefined>(
    (best, p) => (!best || p.createdAt > best.createdAt ? p : best),
    undefined,
  );
}
