import { useLiveQuery } from 'dexie-react-hooks';
import { placeRepo, routeRepo } from '../repo';
import type { PlaceCategory, RouteMode } from '../schema';

export interface Tile {
  key: string;
  kind: 'place' | 'route';
  id: string;
  label: string;
  icon: PlaceCategory | RouteMode;
}

/** Live data of the widget: pinned places and routes first, then the newest; `undefined` while loading. Own data only. */
export function useTiles(): Tile[] | undefined {
  return useLiveQuery(async () => {
    const [places, routes] = await Promise.all([
      placeRepo.active().toArray(),
      routeRepo.active().toArray(),
    ]);
    const all: (Tile & { pinned: boolean; at: number })[] = [
      ...places.map((p) => ({
        key: `p:${p.id}`,
        kind: 'place' as const,
        id: p.id,
        label: p.name,
        icon: p.category,
        pinned: p.pinned,
        at: p.createdAt,
      })),
      ...routes.map((r) => ({
        key: `r:${r.id}`,
        kind: 'route' as const,
        id: r.id,
        label: r.name,
        icon: r.mode,
        pinned: r.pinned,
        at: r.createdAt,
      })),
    ];
    return all.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at).slice(0, 9);
  }, []);
}
