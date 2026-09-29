import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const cache = new WeakMap<object, LazyExoticComponent<ComponentType>>();

/** Stable React.lazy wrapper per loader function (avoids remounts when routes are rebuilt). */
export function lazyComponent(loader: () => Promise<{ default: ComponentType }>) {
  let cmp = cache.get(loader);
  if (!cmp) {
    cmp = lazy(loader);
    cache.set(loader, cmp);
  }
  return cmp;
}
