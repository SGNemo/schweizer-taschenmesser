import type { IconName } from '@/ui/icons';
import { t } from '@/strings';
import type { ModuleStates } from './activation';
import { AREAS, type AreaId, type ModuleManifest } from './types';

/** Path of each area page; it redirects to the module last used there (see `areaTarget`). */
export const AREA_PATHS: Record<AreaId, string> = {
  plan: '/planen',
  money: '/geld',
  household: '/haushalt',
  knowledge: '/wissen',
  vault: '/tresor',
  // Not `/system`: the System module owns that path.
  system: '/geraet',
};

const AREA_ICONS: Record<AreaId, IconName> = {
  plan: 'calendar',
  money: 'wallet',
  household: 'package',
  knowledge: 'note',
  vault: 'lock',
  system: 'cpu',
};

export const MAX_FAVOURITES = 5;
/** Favourites of a fresh installation (only those that are enabled are shown). */
export const DEFAULT_FAVOURITES: readonly string[] = ['calendar', 'todos', 'finance'];

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  moduleId?: string;
}

export interface NavArea {
  id: AreaId;
  label: string;
  icon: IconName;
  /** Area page (`AREA_PATHS`). */
  to: string;
  items: NavItem[];
}

export interface NavTree {
  favourites: NavItem[];
  areas: NavArea[];
}

/** Navigation entries of the enabled modules (routes flagged `nav`), in manifest order. */
export function moduleNavItems(manifests: readonly ModuleManifest[], states: ModuleStates) {
  return manifests
    .filter((m) => states[m.id] && m.area)
    .flatMap((m) =>
      m.routes
        .filter((r) => r.nav)
        .map((r) => ({
          area: m.area!,
          item: {
            to: r.path.replace(/\/\*$/, ''),
            label: r.label,
            icon: m.icon,
            moduleId: m.id,
          } satisfies NavItem,
        })),
    );
}

/**
 * Stored favourite ids → the ids to show: unset = defaults, unknown or disabled modules and
 * duplicates are dropped, at most `MAX_FAVOURITES`.
 */
export function resolveFavourites(
  stored: readonly string[] | undefined,
  enabledIds: ReadonlySet<string>,
): string[] {
  const ids = stored ?? DEFAULT_FAVOURITES;
  return [...new Set(ids)].filter((id) => enabledIds.has(id)).slice(0, MAX_FAVOURITES);
}

/**
 * Sidebar / rail / bottom navigation model. `manifests` must already be sorted and filtered by
 * platform (`availableManifests()`); an area without an enabled module is left out.
 */
export function buildNavTree(
  manifests: readonly ModuleManifest[],
  states: ModuleStates,
  storedFavourites: readonly string[] | undefined,
): NavTree {
  const entries = moduleNavItems(manifests, states);
  const enabled = new Set(entries.flatMap((e) => (e.item.moduleId ? [e.item.moduleId] : [])));
  const favouriteItems = resolveFavourites(storedFavourites, enabled).flatMap((id) => {
    const first = entries.find((e) => e.item.moduleId === id);
    return first ? [first.item] : [];
  });
  const areas = AREAS.map((id) => ({
    id,
    label: t.nav.areas[id],
    icon: AREA_ICONS[id],
    to: AREA_PATHS[id],
    items: entries.filter((e) => e.area === id).map((e) => e.item),
  })).filter((a) => a.items.length > 0);
  return { areas, favourites: favouriteItems };
}

const LAST_KEY = 'tm-area-last';

function readLast(): Partial<Record<AreaId, string>> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as Partial<Record<AreaId, string>>) : {};
  } catch {
    return {};
  }
}

/** Remembers the module path last visited in an area (device-local). */
export function rememberAreaModule(area: AreaId, to: string): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), [area]: to }));
  } catch {
    // Storage may be blocked; the area then opens its first module.
  }
}

/** Where an area page leads: the module last used there if still enabled, else the first one. */
export function areaTarget(area: NavArea): string {
  const last = readLast()[area.id];
  return area.items.find((i) => i.to === last)?.to ?? area.items[0]!.to;
}

/** The area an enabled module path belongs to (longest prefix match), if any. */
export function areaOfPath(tree: NavTree, pathname: string): NavArea | undefined {
  return tree.areas.find((a) =>
    a.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)),
  );
}
