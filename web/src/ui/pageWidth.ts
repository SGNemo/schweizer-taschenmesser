import { createContext, useContext, useSyncExternalStore } from 'react';

/**
 * The width of the page container (`layout/PageContainer`), shared as a tiny store so a consumer only re-renders when its own
 * threshold flips, not on every pixel of a window resize. Master–detail decisions ("panel or dialog") ask this instead of the
 * viewport: the sidebar, the rail and a narrow window all change how much room a page really has.
 */
export interface PageWidthStore {
  get(): number | undefined;
  set(width: number): void;
  subscribe(listener: () => void): () => void;
}

export function createPageWidthStore(): PageWidthStore {
  let width: number | undefined;
  const listeners = new Set<() => void>();
  return {
    get: () => width,
    set(next) {
      if (next === width) return;
      width = next;
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const PageWidthContext = createContext<PageWidthStore | undefined>(undefined);

const never = () => () => undefined;
/** Pixel size of 1 rem; the root size grows with the screen (16 px up to 1920 px, 20 px at 3440 px). */
const remPx = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/**
 * True when the page container is at least `rem` wide, false when it is narrower; `undefined` outside a page container or
 * before it was measured (jsdom never lays out, so tests fall back to the caller's other source).
 */
export function usePageWidthAtLeast(rem: number): boolean | undefined {
  const store = useContext(PageWidthContext);
  return useSyncExternalStore(
    store?.subscribe ?? never,
    () => {
      const w = store?.get();
      return w ? w >= rem * remPx() : undefined;
    },
    () => undefined,
  );
}
