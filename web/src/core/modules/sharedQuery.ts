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

function acquire<T>(
  key: string,
  querier: () => Promise<T> | T,
  prepare?: () => Promise<unknown>,
): Entry<T> {
  let entry = registry.get(key) as Entry<T> | undefined;
  if (!entry) {
    const created: Entry<T> = { snapshot: EMPTY, listeners: new Set(), refs: 0 };
    entry = created;
    registry.set(key, created as Entry<unknown>);
    const notify = () => created.listeners.forEach((l) => l());
    // `prepare` runs before the query starts (see `useSharedLiveQuery`); a failure there is not fatal,
    // the query itself reports what is missing.
    let real: { unsubscribe(): void } | undefined;
    let stopped = false;
    const start = () => {
      if (stopped) return;
      real = Dexie.liveQuery(querier).subscribe(
        (value) => {
          created.snapshot = { has: true, value };
          notify();
        },
        (error) => {
          created.snapshot = { has: false, error };
          notify();
        },
      );
    };
    if (prepare) void prepare().then(start, start);
    else start();
    created.stop = {
      unsubscribe: () => {
        stopped = true;
        real?.unsubscribe();
      },
    };
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

/**
 * `prepare` (optional) finishes before the query first runs. Use it for the lazy `import()`s the
 * querier awaits: a live query whose first run awaits a module that is still being fetched does not
 * track the table reads after that await (the zone is lost on a native await of a pending import), so
 * it would never re-run when the data changes. With the modules loaded first, the first run only
 * awaits cached ones.
 */
export function useSharedLiveQuery<T>(
  key: string,
  querier: () => Promise<T> | T,
  prepare?: () => Promise<unknown>,
): T | undefined {
  // The last result is kept while a new key is loading, like `useLiveQuery` does for new deps.
  const [kept, setKept] = useState<{ has: boolean; value?: T }>({ has: false });
  // The querier of the latest render runs when this subscriber is the one that starts the query.
  const querierRef = useRef(querier);
  const prepareRef = useRef(prepare);
  useEffect(() => {
    querierRef.current = querier;
    prepareRef.current = prepare;
  });

  const subscribe = useCallback(
    (onChange: () => void) => {
      // Must be an `async` function: Dexie only keeps its read tracking across the `await`s inside the
      // query when `liveQuery` is given a native async function; a plain wrapper silently loses it and
      // the query never re-runs when the data changes.
      const entry = acquire<T>(
        key,
        async () => querierRef.current(),
        prepareRef.current ? () => prepareRef.current!() : undefined,
      );
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
