import type { PlatformKind } from '@/core/platform/types';
import { PAGE_LAYOUTS, type ModuleManifest } from './types';

// Manifests are eager (small); heavy parts (routes, widgets) are lazy inside each manifest.
const found = import.meta.glob<{ default: ModuleManifest }>('../../modules/*/manifest.ts', {
  eager: true,
});

/** Every discovered manifest, sorted by id. Used to derive the database schema. */
export const allManifests: readonly ModuleManifest[] = Object.values(found)
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id));

const PLATFORM_KINDS: readonly string[] = ['web', 'desktop', 'android'];

const byOrder = (a: ModuleManifest, b: ModuleManifest) =>
  (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id);

const includeDevOnly = import.meta.env.DEV || import.meta.env.VITE_INCLUDE_EXAMPLE === 'true';

/** Manifests shown in the library (dev-only modules are hidden in normal production builds). */
export const visibleManifests: readonly ModuleManifest[] = allManifests
  .filter((m) => !m.devOnly || includeDevOnly)
  .sort(byOrder);

export const isAvailableOn = (m: ModuleManifest, kind: PlatformKind): boolean =>
  !m.platforms || m.platforms.includes(kind);

let cached: { kind: PlatformKind; list: readonly ModuleManifest[] } | undefined;

/**
 * `visibleManifests` restricted to a platform (`manifest.platforms`). Runtime code uses the
 * no-argument variant in `./available` (it asks `getPlatform()`; kept apart because importing the
 * platform layer here would create an import cycle through the database).
 */
export function availableManifestsFor(kind: PlatformKind): readonly ModuleManifest[] {
  if (cached?.kind !== kind)
    cached = { kind, list: visibleManifests.filter((m) => isAvailableOn(m, kind)) };
  return cached.list;
}

/** One manifest by id (also dev-only ones). */
export function getManifest(id: string): ModuleManifest | undefined {
  return allManifests.find((m) => m.id === id);
}

/** Structural checks shared by the registry unit test and the generator docs. */
export function validateManifest(m: ModuleManifest): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9]*$/.test(m.id)) errors.push(`id "${m.id}" must be lowercase alphanumeric`);
  if (!Number.isInteger(m.version) || m.version < 1)
    errors.push('version must be a positive integer');
  for (const p of m.platforms ?? [])
    if (!PLATFORM_KINDS.includes(p)) errors.push(`platform "${p}" is unknown`);
  if (m.platforms?.length === 0) errors.push('platforms must not be empty (omit it for all)');
  if (m.layout && !PAGE_LAYOUTS.includes(m.layout)) errors.push(`layout "${m.layout}" is unknown`);
  for (const r of m.routes) {
    if (r.layout && !PAGE_LAYOUTS.includes(r.layout))
      errors.push(`route "${r.path}" has unknown layout "${r.layout}"`);
    if (r.path !== `/${m.id}` && !r.path.startsWith(`/${m.id}/`)) {
      errors.push(`route "${r.path}" must start with "/${m.id}"`);
    }
  }
  for (const v of Object.keys(m.migrations).map(Number)) {
    if (v > m.version) errors.push(`migration ${v} is newer than manifest version ${m.version}`);
  }
  for (const [name, c] of Object.entries(m.aiSchema?.collections ?? {})) {
    if (!(name in m.dataSchema.collections))
      errors.push(`aiSchema collection "${name}" has no dataSchema`);
    if (!(c.titleField in c.fields)) errors.push(`aiSchema "${name}".titleField is not a field`);
  }
  const onboarding = m.contributions?.onboarding;
  if (!onboarding) {
    errors.push(
      'contributions.onboarding is required (use noOnboarding when there is nothing to import)',
    );
  } else {
    const ids = new Set<string>();
    for (const imp of onboarding.importers) {
      if (ids.has(imp.id)) errors.push(`onboarding importer id "${imp.id}" is used twice`);
      ids.add(imp.id);
      if (imp.kind === 'template' && !imp.templates?.length)
        errors.push(`onboarding importer "${imp.id}" (template) needs templates`);
      if (imp.kind === 'form' && !imp.fields?.length)
        errors.push(`onboarding importer "${imp.id}" (form) needs fields`);
      if (imp.kind === 'file' && !imp.accept)
        errors.push(`onboarding importer "${imp.id}" (file) needs accept`);
      if (imp.kind === 'connector' && !imp.connectorId)
        errors.push(`onboarding importer "${imp.id}" (connector) needs connectorId`);
    }
    if (onboarding.importers.length > 0 && !onboarding.load)
      errors.push('onboarding.load is required when importers are declared');
  }
  return errors;
}
