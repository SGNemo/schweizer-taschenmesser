/**
 * Basis / Erweitert view (synced scope `comfort`). Default is Basis. One global switch ("Alle
 * Module Erweitert") and an optional per-module choice that overrides it. Rules and plan:
 * docs/product/comfort/02-plan.md.
 */
import { z } from 'zod';
import { getSettings, setSettings, useSettings } from './settings';

export const COMFORT_SCOPE = 'comfort';

export const comfortSettingsSchema = z.object({
  /** "Alle Module Erweitert". */
  advancedAll: z.boolean(),
  /** A module's own choice; absent = follow `advancedAll`. */
  advancedModules: z.record(z.string(), z.enum(['basic', 'advanced'])),
});
export type ComfortSettings = z.infer<typeof comfortSettingsSchema>;

export const DEFAULT_COMFORT: ComfortSettings = { advancedAll: false, advancedModules: {} };

/** Whether `moduleId` shows the advanced view: its own choice first, else the global switch. */
export function resolveAdvanced(s: ComfortSettings, moduleId: string): boolean {
  const own = s.advancedModules[moduleId];
  return own ? own === 'advanced' : s.advancedAll;
}

/** Settings after the module's switch was set to `advanced` (the module's choice is stored; it overrides the global switch). */
export function withModuleAdvanced(
  s: ComfortSettings,
  moduleId: string,
  advanced: boolean,
): Pick<ComfortSettings, 'advancedModules'> {
  return {
    advancedModules: { ...s.advancedModules, [moduleId]: advanced ? 'advanced' : 'basic' },
  };
}

export function useComfortSettings(): readonly [
  ComfortSettings,
  (patch: Partial<ComfortSettings>) => Promise<void>,
] {
  const [values, patch] = useSettings(COMFORT_SCOPE, comfortSettingsSchema, DEFAULT_COMFORT);
  return [values ?? DEFAULT_COMFORT, patch] as const;
}

/** `[advanced, setAdvanced]` of one module for components. */
export function useAdvanced(moduleId: string): readonly [boolean, (advanced: boolean) => void] {
  const [s, patch] = useComfortSettings();
  return [
    resolveAdvanced(s, moduleId),
    (advanced) => void patch(withModuleAdvanced(s, moduleId, advanced)),
  ] as const;
}

export const getComfortSettings = (): Promise<ComfortSettings> =>
  getSettings(COMFORT_SCOPE, comfortSettingsSchema, DEFAULT_COMFORT);

export const patchComfortSettings = (patch: Partial<ComfortSettings>): Promise<void> =>
  setSettings(COMFORT_SCOPE, patch);
