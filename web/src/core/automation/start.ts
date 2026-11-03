/** Wires the engine into the running app (called once from `initCore`). Does nothing until the master switch is on. */
import { availableManifests } from '@/core/modules/available';
import { loadModuleStates } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import type { EngineDeps } from './engine';
import { startWriteEvents } from './ingest';
import { startAutomationScheduler } from './scheduler';
import { getAutomationSettings } from './settings';
import { resolveRules } from './templates';
import type { Rule } from './types';

const CACHE_MS = 5_000;

export function createDeps(): EngineDeps & {
  wants: (type: string) => boolean;
  refresh: () => Promise<void>;
} {
  let manifests: ModuleManifest[] = [];
  let rules: Rule[] = [];
  let types = new Set<string>();
  let enabled = false;
  let loadedAt = 0;
  const refresh = async (): Promise<void> => {
    const [settings, states] = await Promise.all([getAutomationSettings(), loadModuleStates()]);
    manifests = availableManifests().filter((m) => states[m.id]);
    rules = resolveRules(settings);
    enabled = settings.enabled;
    types = new Set(rules.flatMap((r) => (r.trigger.kind === 'event' ? [r.trigger.type] : [])));
    loadedAt = Date.now();
  };
  const fresh = async () => {
    if (Date.now() - loadedAt > CACHE_MS) await refresh();
  };
  return {
    refresh,
    rules: async () => (await fresh(), rules),
    settings: async () => {
      await fresh();
      const s = await getAutomationSettings();
      return { enabled, dryRun: s.dryRun, globalPerHour: s.globalPerHour };
    },
    manifests: () => manifests,
    known: () => availableManifests(),
    wants: (type) => enabled && types.has(type),
  };
}

export function startAutomation(): () => void {
  const deps = createDeps();
  void deps.refresh();
  const stopEvents = startWriteEvents(deps, { wants: deps.wants });
  const stopTick = startAutomationScheduler(deps);
  return () => {
    stopEvents();
    stopTick();
  };
}
