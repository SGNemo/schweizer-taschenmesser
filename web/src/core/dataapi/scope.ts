/**
 * What the data API and the JSON import may touch. Like `core/ai/scope.ts` this is the single
 * filter: only manifest collections are ever addressed (system tables, settings and secrets are not
 * in any manifest), and modules that hold secrets are excluded twice – by the `dataApi: false`
 * opt-out and by a hard id block that no manifest can lift.
 */
import type { ModuleManifest } from '@/core/modules/types';

/** Modules that must never be reachable, whatever their manifest says. */
export const BLOCKED_MODULES: readonly string[] = ['accounts'];

/** Names of the collections of a module that the API exposes (synced, not opted out). */
export function apiCollections(manifest: ModuleManifest): string[] {
  if (manifest.dataApi === false || BLOCKED_MODULES.includes(manifest.id)) return [];
  return Object.entries(manifest.dataSchema.collections)
    .filter(([, def]) => !def.local && def.dataApi !== false)
    .map(([name]) => name);
}

export const isDataApiModule = (manifest: ModuleManifest): boolean =>
  apiCollections(manifest).length > 0;

/** Modules the API offers, given which ones the user has switched on. */
export function apiModules(
  manifests: readonly ModuleManifest[],
  states: Record<string, boolean>,
): ModuleManifest[] {
  return manifests.filter((m) => states[m.id] === true && isDataApiModule(m));
}
