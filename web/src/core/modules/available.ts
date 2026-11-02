import { useMemo } from 'react';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { availableManifestsFor } from './registry';
import type { ModuleManifest } from './types';

/**
 * Modules that exist on the running platform. A function, not a constant: the platform is only
 * known after `initPlatform()`, and module states are synced, so a desktop-only module must also
 * vanish from router, navigation, dashboard and services on the other platforms.
 *
 * This is the runtime universe: routes, services, sync, seed, data API and AI scope use it, so a
 * `preview` module the user switched on keeps working. Catalogues (library, palette, setup) go
 * through `isVisible` / `catalogManifests` instead.
 */
export const availableManifests = (): readonly ModuleManifest[] =>
  availableManifestsFor(getPlatform().kind);

/** What the maturity filter looks at. */
export interface MaturityContext {
  /** "In Arbeit anzeigen" (`stores/ui.ts`). */
  showPreview: boolean;
  /** Is the module switched on? Undefined while the states are still loading (= not on). */
  isEnabled?: (moduleId: string) => boolean;
}

/**
 * The one maturity rule for modules: a `preview` module is listed only while "In Arbeit anzeigen"
 * is on or the user has already switched it on (preview hides in catalogues and default lists,
 * never active data or routes). Platform (`manifest.platforms`), `retired` and `devOnly` are
 * applied before, in the registry.
 */
export function isVisible(m: ModuleManifest, ctx: MaturityContext): boolean {
  return m.maturity !== 'preview' || ctx.showPreview || ctx.isEnabled?.(m.id) === true;
}

/** `availableManifests()` for catalogues: without the preview modules the context hides. */
export const catalogManifests = (ctx: MaturityContext): readonly ModuleManifest[] =>
  availableManifests().filter((m) => isVisible(m, ctx));

/** Live `catalogManifests` for components: follows the "In Arbeit anzeigen" switch and the module states. */
export function useCatalogManifests(
  states: Readonly<Record<string, boolean>> | undefined,
): readonly ModuleManifest[] {
  const showPreview = useUiStore((s) => s.showPreview);
  return useMemo(
    () => catalogManifests({ showPreview, isEnabled: (id) => Boolean(states?.[id]) }),
    [showPreview, states],
  );
}
