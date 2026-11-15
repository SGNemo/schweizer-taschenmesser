import { createElement, lazy, useState, type ComponentType, type LazyExoticComponent } from 'react';

type Loader = () => Promise<{ default: ComponentType }>;
interface Entry {
  lazy: LazyExoticComponent<ComponentType>;
  component: ComponentType<Record<string, unknown>>;
  /** Set once the code is loaded (by a render or by `preloadComponent`). */
  resolved?: ComponentType;
  load: () => Promise<{ default: ComponentType }>;
}

const cache = new WeakMap<object, Entry>();

function entryFor(loader: Loader): Entry {
  let entry = cache.get(loader);
  if (entry) return entry;
  let pending: Promise<{ default: ComponentType }> | undefined;
  const load = () =>
    (pending ??= loader().then(
      (m) => {
        created.resolved = m.default;
        return m;
      },
      (e: unknown) => {
        pending = undefined; // a failed load may be tried again (offline, a stale page)
        throw e;
      },
    ));
  const lazyCmp = lazy(load);
  /**
   * Code that is already loaded renders at once. React.lazy suspends on its first render even when the module is
   * there, and React reveals the content of a suspended boundary only after its fallback throttle (≈ 300 ms): every
   * first visit of a preloaded page showed the loading card for that long (docs/perf/CLICK-TO-CONTENT-2026-11.md).
   * The choice is made once per mount, so a mounted instance never switches its element type.
   */
  function LoadedOrLazy(props: Record<string, unknown>) {
    const [loaded] = useState(() => created.resolved);
    return createElement(loaded ?? lazyCmp, props);
  }
  const created: Entry = { lazy: lazyCmp, component: LoadedOrLazy, load };
  entry = created;
  cache.set(loader, entry);
  return entry;
}

/** Stable component per loader function (avoids remounts when routes are rebuilt); renders at once once loaded. */
export function lazyComponent(loader: Loader): ComponentType<Record<string, unknown>> {
  return entryFor(loader).component;
}

/** Loads the code behind `loader` without rendering it; a later `lazyComponent(loader)` renders without suspending. */
export function preloadComponent(loader: Loader): Promise<unknown> {
  return entryFor(loader)
    .load()
    .catch(() => undefined);
}
