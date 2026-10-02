import { useMemo } from 'react';
import { hasStartData } from '@/core/dataapi/onboarding';
import { useModuleStates } from '@/core/modules/activation';
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

/** Sections visible right now (platform, dev build, enabled modules), in navigation order. */
export function useSettingsSections(): SettingsSectionDef[] {
  const states = useModuleStates();
  return useMemo(() => {
    if (!states) return [];
    const ctx: SettingsContext = {
      platform: getPlatform().kind,
      isDev: isDevBuild(),
      isModuleEnabled: (id) => Boolean(states[id]),
    };
    return visibleSections(allSettingsSections(), ctx);
  }, [states]);
}
