/** Wires the engine into the running app (called once from `initCore`). Does nothing until the master switch is on. */
import { bus } from '@/core/events';
import { availableManifests } from '@/core/modules/available';
import { loadModuleStates } from '@/core/modules/activation';
import type { ModuleManifest } from '@/core/modules/types';
import { now } from '@/core/time/now';
import { processEvent, type EngineDeps } from './engine';
import { startWriteEvents } from './ingest';
import { buildRegistry, isRunnable, type AutomationRegistry } from './registry';
import { startAutomationScheduler, type TickDeps } from './scheduler';
import { getAutomationSettings } from './settings';
import { resolveRules } from './templates';
import type { Rule } from './types';

const CACHE_MS = 5_000;

export interface LiveDeps extends TickDeps {
  wants: (type: string) => boolean;
  watched: (moduleId: string, collection: string) => boolean;
  derive: AutomationRegistry['derive'];
  refresh: () => Promise<void>;
}

export function createDeps(onLoaded?: (enabled: boolean) => void): LiveDeps {
  let manifests: ModuleManifest[] = [];
  let registry: AutomationRegistry | undefined;
  let rules: Rule[] = [];
  let types = new Set<string>();
  let enabled = false;
  let loadedAt = 0;
  let loading: Promise<void> | undefined;
  const load = async (): Promise<void> => {
    const [settings, states] = await Promise.all([getAutomationSettings(), loadModuleStates()]);
    manifests = availableManifests().filter((m) => states[m.id]);
    enabled = settings.enabled;
    // Modules are only read once the master switch is on.
    registry = enabled ? await buildRegistry(manifests) : undefined;
    rules = registry ? resolveRules(settings).filter((r) => isRunnable(r, registry!)) : [];
    types = new Set(rules.flatMap((r) => (r.trigger.kind === 'event' ? [r.trigger.type] : [])));
    loadedAt = Date.now();
    onLoaded?.(enabled);
  };
  const refresh = (): Promise<void> => (loading ??= load().finally(() => (loading = undefined)));
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
    allowed: (module, action) => registry?.allowed(module, action) ?? false,
    wants: (type) => enabled && types.has(type),
    watched: (moduleId, collection) => registry?.watched(moduleId, collection) ?? false,
    derive: (signal, base) => registry?.derive(signal, base) ?? [],
    detectors: async () => {
      await fresh();
      return registry?.detectors ?? [];
    },
  };
}

export function startAutomation(): () => void {
  // The write listener exists only while the master switch is on, so with automations off every
  // write stays as cheap as before (no row copies, no events). A switch change is picked up by the
  // next tick (within a minute).
  let stopEvents: (() => void) | undefined;
  const deps: EngineDeps & LiveDeps = createDeps((enabled) => {
    if (enabled && !stopEvents) {
      stopEvents = startWriteEvents(deps, {
        wants: deps.wants,
        watched: deps.watched,
        derive: deps.derive,
      });
    } else if (!enabled && stopEvents) {
      stopEvents();
      stopEvents = undefined;
    }
  });
  void deps.refresh();
  // Domain events other modules report on the bus (`mail.invoiceReceived`).
  const offBus = bus.on('automation.event', (e) => {
    if (!deps.wants(e.type)) return;
    void processEvent({ ...e, at: now() }, deps).catch((err) =>
      console.error('[automation] event failed', err),
    );
  });
  const stopTick = startAutomationScheduler(deps);
  return () => {
    stopEvents?.();
    offBus();
    stopTick();
  };
}
