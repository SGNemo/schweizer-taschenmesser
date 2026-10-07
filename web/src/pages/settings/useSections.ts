import { useMemo } from 'react';
import { useAiOn } from '@/core/ai/switch';
import { hasStartData } from '@/core/dataapi/onboarding';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadModuleStates, type ModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { getPlatform } from '@/core/platform';
import { validateSections, visibleSections } from '@/core/settings/registry/registry';
import type { SettingsContext, SettingsSectionDef } from '@/core/settings/registry/types';
import { isDevBuild } from '@/core/update/buildInfo';
import { createElement } from 'react';
import { ModuleSection } from './ModuleSection';
import { CORE_SECTIONS } from './sections';

const MODULE_ORDER = 100;

/** Sections contributed by module manifests: one per module with settings or start data. */
export function moduleSections(
  manifests: ReturnType<typeof availableManifests>,
): SettingsSectionDef[] {
  return manifests
    .filter((m) => m.settings.fields.length > 0 || hasStartData(m))
    .map((m) => ({
      id: `module-${m.id}`,
      category: m.settings.category ?? 'module',
      order: m.settings.order ?? MODULE_ORDER,
      title: m.name,
      description: m.description,
      keywords: m.settings.keywords,
      fields: m.settings.fields.map((f) => ({ key: f.key, label: f.label, description: f.help })),
      visibleWhen: (ctx: SettingsContext) => ctx.isModuleEnabled(m.id),
      render: () => createElement(ModuleSection, { manifest: m }),
    }));
}

/** All registered sections (core + modules); throws on an invalid registration (tested). */
export function allSettingsSections(
  manifests: ReturnType<typeof availableManifests> = availableManifests(),
): SettingsSectionDef[] {
  const all = [...CORE_SECTIONS, ...moduleSections(manifests)];
  const errors = validateSections(all);
  if (errors.length > 0) throw new Error(`Invalid settings registry: ${errors.join('; ')}`);
  return all;
}

/**
 * The module states last read. The command palette remounts its body on every open, so a fresh
 * live query would be empty for a moment and the settings commands would be missing exactly when the
 * first key is typed.
 */
let lastStates: ModuleStates | undefined;

/** Sections visible right now (platform, dev build, enabled modules), in navigation order. */
export function useSettingsSections(): SettingsSectionDef[] {
  const aiOn = useAiOn();
  const states = useLiveQuery(
    async () => {
      const read = await loadModuleStates();
      lastStates = read;
      return read;
    },
    [],
    lastStates,
  );
  return useMemo(() => {
    if (!states) return [];
    const ctx: SettingsContext = {
      platform: getPlatform().kind,
      isDev: isDevBuild(),
      isModuleEnabled: (id) => Boolean(states[id]),
      aiOn,
    };
    return visibleSections(allSettingsSections(), ctx);
  }, [states, aiOn]);
}
