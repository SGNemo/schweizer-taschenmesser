import { hasStartData } from '@/core/dataapi/onboarding';
import type { availableManifests } from '@/core/modules/available';
import { settingsPath } from '@/core/settings/registry/paths';

type Manifest = ReturnType<typeof availableManifests>[number];

/**
 * Does the module have a settings section (settings fields or start data)? Its own file, apart from `useSections`:
 * the overview and the module frame need only this, and importing the section registry would put all of the
 * settings into the start bundle (docs/perf/CLICK-TO-CONTENT-2026-11.md).
 */
export const hasSection = (m: Manifest) => m.settings.fields.length > 0 || hasStartData(m);

/** `/settings/<category>#module-<id>` for a module that has settings, else undefined. */
export function moduleSettingsPath(m: Manifest): string | undefined {
  return hasSection(m)
    ? settingsPath(m.settings.category ?? 'module', `module-${m.id}`)
    : undefined;
}
