import { Dexie } from 'dexie';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * One live query per key for any number of hook instances (`useLiveQuery` runs one per instance).
 *
 * The home screen mounts the same contribution hooks several times (calendar items, "Jetzt wichtig",
 * headlines); each instance used to run every module source and re-run it on every write. Here the
 * instances with the same key share one `liveQuery`: it starts with the first subscriber and stops
 * shortly after the last one has left. Behaviour matches `useLiveQuery`: `undefined` until the first
 * result, the previous result is kept while another key loads, a failing query throws into the
 * nearest error boundary.
 *
 * The key must contain every input of the query (the querier of the first subscriber runs for all).
 */

interface Snapshot<T> {
  has: boolean;
  value?: T;
  error?: unknown;
}

interface Entry<T> {
  snapshot: Snapshot<T>;
  listeners: Set<() => void>;
  refs: number;
  stop?: { unsubscribe(): void };
  /** Pending teardown after the last subscriber left (cancelled when someone subscribes again). */
  timer?: ReturnType<typeof setTimeout>;
}

const EMPTY: Snapshot<never> = { has: false };
const registry = new Map<string, Entry<unknown>>();

/** Grace period before an unused query stops: covers re-mounts while navigating and StrictMode. */
const LINGER_MS = 50;

function acquire<T>(key: string, querier: () => Promise<T> | T): Entry<T> {
  let entry = registry.get(key) as Entry<T> | undefined;
  if (!entry) {
    const created: Entry<T> = { snapshot: EMPTY, listeners: new Set(), refs: 0 };
    entry = created;
    registry.set(key, created as Entry<unknown>);
    const notify = () => created.listeners.forEach((l) => l());
    created.stop = Dexie.liveQuery(querier).subscribe(
      (value) => {
        created.snapshot = { has: true, value };
        notify();
      },
      (error) => {
        created.snapshot = { has: false, error };
        notify();
      },
    );
  }
  if (entry.timer !== undefined) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
  }
  entry.refs++;
  return entry;
}

function release(key: string): void {
  const entry = registry.get(key);
  if (!entry) return;
  entry.refs--;
  if (entry.refs > 0) return;
  entry.timer = setTimeout(() => {
    if (entry.refs > 0) return;
    entry.stop?.unsubscribe();
    registry.delete(key);
  }, LINGER_MS);
}

/** Number of running shared queries (tests). */
export const sharedQueryCount = (): number => registry.size;

export function useSharedLiveQuery<T>(key: string, querier: () => Promise<T> | T): T | undefined {
  // The last result is kept while a new key is loading, like `useLiveQuery` does for new deps.
  const [kept, setKept] = useState<{ has: boolean; value?: T }>({ has: false });
  // The querier of the latest render runs when this subscriber is the one that starts the query.
  const querierRef = useRef(querier);
  useEffect(() => {
    querierRef.current = querier;
  });

  const subscribe = useCallback(
    (onChange: () => void) => {
      const entry = acquire<T>(key, () => querierRef.current());
      entry.listeners.add(onChange);
      // The query may have produced its first result before this subscriber was attached.
      if (entry.snapshot !== EMPTY) onChange();
      return () => {
        entry.listeners.delete(onChange);
        release(key);
      };
    },
    [key],
  );
  const getSnapshot = useCallback(
    () => (registry.get(key)?.snapshot ?? EMPTY) as Snapshot<T>,
    [key],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (snapshot.error !== undefined) throw snapshot.error;
  if (snapshot.has && (!kept.has || kept.value !== snapshot.value))
    setKept({ has: true, value: snapshot.value });
  if (snapshot.has) return snapshot.value;
  return kept.has ? kept.value : undefined;
}
