/**
 * Where events come from: writes of the modules (through the repo hook), state checks of the modules
 * ("detectors") and the clock (schedule triggers). Nothing here changes how a module looks or works.
 */
import { setWriteListener, type WriteSignal } from '@/core/db/writeHook';
import { now } from '@/core/time/now';
import { currentCause, processEvent, type EngineDeps } from './engine';
import { EXCLUDED_MODULES, type AutomationEvent } from './types';

/** `<moduleId>_<collection>` → ids; module ids contain no underscore. System tables start with one. */
export function splitTable(table: string): { moduleId: string; collection: string } | undefined {
  if (table.startsWith('_')) return undefined;
  const i = table.indexOf('_');
  return i > 0 ? { moduleId: table.slice(0, i), collection: table.slice(i + 1) } : undefined;
}

const titleOf = (data: Record<string, unknown> | undefined): string | undefined => {
  const v = data?.title ?? data?.name ?? data?.payee;
  return typeof v === 'string' ? v : undefined;
};

/** Optional per-module refinement: more events for the same write (e.g. `completed`). */
export type Derive = (signal: WriteSignal, event: AutomationEvent) => AutomationEvent[];

export function eventsOf(signal: WriteSignal, at: number, derive?: Derive): AutomationEvent[] {
  const parts = splitTable(signal.table);
  if (!parts || EXCLUDED_MODULES.includes(parts.moduleId)) return [];
  const cause = currentCause();
  const title = titleOf(signal.data);
  const base: AutomationEvent = {
    type: `${parts.moduleId}.${parts.collection}.${signal.kind}`,
    moduleId: parts.moduleId,
    key: `${signal.kind}:${signal.id}:${at}`,
    at,
    data: { ...(signal.data ?? {}), id: signal.id },
    ...(title ? { title } : {}),
    ...(cause ? { cause } : {}),
  };
  return [
    base,
    ...(derive?.(signal, base) ?? []).map((e) => ({ ...e, ...(cause ? { cause } : {}) })),
  ];
}

/**
 * Installs the write listener. Events are handed to the engine without waiting, so a write never
 * waits for a rule. `watch` lets the caller skip event types no rule listens to.
 */
export function startWriteEvents(
  deps: EngineDeps,
  options: { derive?: Derive; wants?: (type: string) => boolean } = {},
): () => void {
  setWriteListener((signal) => {
    for (const event of eventsOf(signal, now(), options.derive)) {
      if (options.wants && !options.wants(event.type)) continue;
      void processEvent(event, deps).catch((e) => console.error('[automation] event failed', e));
    }
  });
  return () => setWriteListener(undefined);
}

/** Domain events a module reports (`invoice.dueSoon` …): same path, explicit type and key. */
export function emitDomainEvent(
  event: Omit<AutomationEvent, 'at' | 'cause'> & { at?: number },
  deps: EngineDeps,
): Promise<unknown> {
  const cause = currentCause();
  return processEvent({ ...event, at: event.at ?? now(), ...(cause ? { cause } : {}) }, deps);
}
