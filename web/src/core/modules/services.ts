import { liveQuery } from 'dexie';
import { loadModuleStates, type ModuleStates } from './activation';
import { availableManifests } from '@/core/modules/available';
import type { ModuleManifest } from './types';

export interface ServiceManager {
  /** Starts services of newly enabled modules and stops those of disabled ones. */
  update(states: ModuleStates): Promise<void>;
  stopAll(): Promise<void>;
  running(): string[];
}

/**
 * Keeps `contributions.services` of exactly the enabled modules running. Updates are serialised,
 * so quickly toggling a module can never start a service twice or leak a subscription.
 */
export function createServiceManager(manifests: readonly ModuleManifest[]): ServiceManager {
  const running = new Map<string, () => void>();
  let chain: Promise<void> = Promise.resolve();

  async function reconcile(states: ModuleStates): Promise<void> {
    for (const m of manifests) {
      const load = m.contributions?.services;
      if (!load) continue;
      const want = states[m.id] === true;
      const stop = running.get(m.id);
      if (want && !stop) {
        try {
          const start = (await load()).default;
          running.set(m.id, start() ?? (() => undefined));
        } catch (e) {
          console.error(`[services] "${m.id}" failed to start`, e);
        }
      } else if (!want && stop) {
        running.delete(m.id);
        stop();
      }
    }
  }

  const enqueue = (fn: () => Promise<void>) => (chain = chain.then(fn, fn));

  return {
    update: (states) => enqueue(() => reconcile(states)),
    stopAll: () =>
      enqueue(async () => {
        for (const stop of running.values()) stop();
        running.clear();
      }),
    running: () => [...running.keys()],
  };
}

/** Runs the services of all enabled modules for the lifetime of the app; follows module toggles. */
export function startModuleServices(): () => void {
  const manager = createServiceManager(availableManifests());
  const sub = liveQuery(() => loadModuleStates()).subscribe({
    next: (states) => void manager.update(states),
    error: (e) => console.error('[services] module state stream failed', e),
  });
  return () => {
    sub.unsubscribe();
    void manager.stopAll();
  };
}
