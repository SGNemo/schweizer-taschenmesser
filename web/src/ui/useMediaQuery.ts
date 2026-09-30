import { useSyncExternalStore } from 'react';

/**
 * Subscribes to a media query. Re-renders only when the query starts or stops matching (not on
 * every resize tick), so it is cheap enough for structural decisions such as "panel or dialog".
 * Pure styling belongs in CSS / container queries instead.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  );
}
