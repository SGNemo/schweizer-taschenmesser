import { PAGE_LAYOUTS, type ModuleManifest } from './types';

// Manifests are eager (small); heavy parts (routes, widgets) are lazy inside each manifest.
const found = import.meta.glob<{ default: ModuleManifest }>('../../modules/*/manifest.ts', {
  eager: true,
});

/** Every discovered manifest, sorted by id. Used to derive the database schema. */
export const allManifests: readonly ModuleManifest[] = Object.values(found)
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id));

const byOrder = (a: ModuleManifest, b: ModuleManifest) =>
  (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id);

const includeDevOnly = import.meta.env.DEV || import.meta.env.VITE_INCLUDE_EXAMPLE === 'true';

/** Manifests shown in the library (dev-only modules are hidden in normal production builds). */
export const visibleManifests: readonly ModuleManifest[] = allManifests
  .filter((m) => !m.devOnly || includeDevOnly)
  .sort(byOrder);

export function getManifest(id: string): ModuleManifest | undefined {
  return visibleManifests.find((m) => m.id === id);
}

/** Structural checks shared by the registry unit test and the generator docs. */
export function validateManifest(m: ModuleManifest): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9]*$/.test(m.id)) errors.push(`id "${m.id}" must be lowercase alphanumeric`);
  if (!Number.isInteger(m.version) || m.version < 1)
    errors.push('version must be a positive integer');
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
  return errors;
}
