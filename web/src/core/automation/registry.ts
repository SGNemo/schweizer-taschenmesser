/** What the enabled modules offer the engine, gathered once (and again when modules are switched). */
import type { ModuleManifest } from '@/core/modules/types';
import type { Derive } from './ingest';
import type { ModuleAutomation } from './module';
import type { Detector } from './scheduler';
import { splitTable } from './ingest';
import { EXCLUDED_MODULES, type Rule } from './types';

const KINDS = ['created', 'updated', 'deleted', 'restored'] as const;

export interface AutomationRegistry {
  byModule: ReadonlyMap<string, ModuleAutomation>;
  /** Every event type a rule may listen to. */
  eventTypes: ReadonlySet<string>;
  watched: (moduleId: string, collection: string) => boolean;
  allowed: (module: string, action: string) => boolean;
  derive: Derive;
  detectors: Detector[];
}

export async function buildRegistry(
  manifests: readonly ModuleManifest[],
): Promise<AutomationRegistry> {
  const byModule = new Map<string, ModuleAutomation>();
  for (const m of manifests) {
    if (EXCLUDED_MODULES.includes(m.id) || !m.automation) continue;
    try {
      byModule.set(m.id, (await m.automation()).default);
    } catch (e) {
      console.error(`[automation] ${m.id} failed to load`, e);
    }
  }
  const eventTypes = new Set<string>();
  for (const [id, a] of byModule) {
    for (const c of Object.keys(a.watch ?? {}))
      for (const k of KINDS) eventTypes.add(`${id}.${c}.${k}`);
    for (const type of Object.keys(a.events ?? {})) eventTypes.add(type);
  }
  return {
    byModule,
    eventTypes,
    watched: (moduleId, collection) => !!byModule.get(moduleId)?.watch?.[collection],
    allowed: (module, action) => !!byModule.get(module)?.actions?.includes(action),
    derive: (signal, base) => {
      const parts = splitTable(signal.table);
      return (parts && byModule.get(parts.moduleId)?.derive?.(signal, base)) || [];
    },
    detectors: [...byModule.values()].flatMap((a) => a.detectors ?? []),
  };
}

/** A rule only runs when its trigger exists and its entry actions are ones a module allows. */
export function isRunnable(rule: Rule, registry: AutomationRegistry): boolean {
  if (rule.trigger.kind === 'event' && !registry.eventTypes.has(rule.trigger.type)) return false;
  return rule.actions.every(
    (a) =>
      (a.kind !== 'entry' && a.kind !== 'suggest') ||
      (!EXCLUDED_MODULES.includes(a.module) && registry.allowed(a.module, a.action)),
  );
}
