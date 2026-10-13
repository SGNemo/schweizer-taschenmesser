import { useEffect } from 'react';
import { useLocation } from 'react-router';

/** How long a deep-linked element stays marked. */
const MARK_MS = 1600;

/**
 * Scrolls to the element whose id is the URL hash (`/library#module-todos`) and marks it for a
 * moment (`data-hash-target`, outline in `global.css`; static, so reduced motion needs nothing).
 * `ready` is false while the target is not rendered yet.
 */
export function useHashTarget(ready: boolean): void {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.dataset.hashTarget = 'true';
    const timer = setTimeout(() => delete el.dataset.hashTarget, MARK_MS);
    return () => {
      clearTimeout(timer);
      delete el.dataset.hashTarget;
    };
  }, [ready, hash, pathname]);
}
