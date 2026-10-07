import { liveQuery } from 'dexie';
import { loadModuleStates, type ModuleStates } from './activation';
import { availableManifests } from '@/core/modules/available';
import { setServicesWaiter } from './servicesReady';
import type { ModuleManifest } from './types';

export interface ServiceManager {
  /** Starts services of newly enabled modules and stops those of disabled ones. */
  update(states: ModuleStates): Promise<void>;
  stopAll(): Promise<void>;
  running(): string[];
  /** Resolves once every update queued so far has finished (services loaded and started). */
  settled(): Promise<void>;
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
    settled: () => chain,
  };
}

/** Runs the services of all enabled modules for the lifetime of the app; follows module toggles. */
export function startModuleServices(): () => void {
  const manager = createServiceManager(availableManifests());
  let firstDone!: () => void;
  const firstUpdate = new Promise<void>((resolve) => (firstDone = resolve));
  const mine: Parameters<typeof setServicesWaiter>[0] = (opts) =>
    firstUpdate
      .then(async () => {
        if (opts?.fresh) await manager.update(await loadModuleStates());
      })
      .then(() => manager.settled());
  setServicesWaiter(mine);
  const sub = liveQuery(() => loadModuleStates()).subscribe({
    next: (states) => void manager.update(states).then(firstDone),
    error: (e) => {
      console.error('[services] module state stream failed', e);
      firstDone();
    },
  });
  return () => {
    sub.unsubscribe();
    void manager.stopAll();
    setServicesWaiter(null);
    firstDone();
  };
}
