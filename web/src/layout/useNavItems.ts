import { createContext, useContext, useMemo } from 'react';
import { useModuleStates, type ModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { buildNavTree, moduleNavItems, type NavItem, type NavTree } from '@/core/modules/areas';
import { useStoredFavourites } from '@/core/settings/nav';

export type { NavItem };

const EMPTY: NavTree = { areas: [], favourites: [] };

/**
 * The module states the router has already loaded (it builds the routes from them). A component that mounts with a
 * route reads its own live query, which is empty for its first render; until it answers, the tree is built from these,
 * so the module head, the sub-navigation and the sidebar are there in the first paint (U01, no layout shift).
 */
export const LoadedModuleStates = createContext<ModuleStates | undefined>(undefined);

/** Sidebar / rail / bottom navigation model: favourites and the areas with their enabled modules. */
export function useNavTree(): NavTree {
  const loaded = useContext(LoadedModuleStates);
  const states = useModuleStates() ?? loaded;
  const { ready, stored } = useStoredFavourites();
  return useMemo(() => {
    if (!states) return EMPTY;
    const tree = buildNavTree(availableManifests(), states, stored);
    // Until the setting is read the favourites stay empty instead of flashing the defaults.
    return ready ? tree : { ...tree, favourites: [] };
  }, [states, stored, ready]);
}

/** Flat navigation entries of all enabled modules (command palette). */
export function useModuleNavItems(): NavItem[] {
  const states = useModuleStates();
  if (!states) return [];
  return moduleNavItems(availableManifests(), states).map((e) => e.item);
}

export interface QuickAddAction {
  id: string;
  label: string;
  to: string;
  icon: NavItem['icon'];
}

/** The "new …" entries of all enabled modules (quick-add sheet and command palette). */
export function useQuickAddActions(): QuickAddAction[] {
  const states = useModuleStates();
  if (!states) return [];
  return availableManifests()
    .filter((m) => states[m.id])
    .flatMap((m) => (m.contributions?.quickAdd ?? []).map((a) => ({ ...a, icon: m.icon })));
}
