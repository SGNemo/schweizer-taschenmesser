/**
 * Typed in-memory event bus. Modules talk to each other only through this bus
 * (or through manifest contributions) – never by importing each other.
 */
import type { EventMap } from './events';

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>;

export interface EventBus {
  on<K extends keyof EventMap>(type: K, handler: Handler<K>): () => void;
  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): Promise<void>;
  clear(): void;
}

export function createEventBus(): EventBus {
  const handlers = new Map<keyof EventMap, Set<Handler<never>>>();

  return {
    on(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as Handler<never>);
      handlers.set(type, set);
      return () => {
        set.delete(handler as Handler<never>);
      };
    },
    async emit(type, payload) {
      const set = handlers.get(type);
      if (!set) return;
      // A failing subscriber must never break the emitter or other subscribers.
      const results = await Promise.allSettled(
        [...set].map(async (h) => (h as Handler<typeof type>)(payload)),
      );
      for (const r of results) {
        if (r.status === 'rejected')
          console.error(`[events] handler for "${type}" failed`, r.reason);
      }
    },
    clear() {
      handlers.clear();
    },
  };
}

export const bus: EventBus = createEventBus();
