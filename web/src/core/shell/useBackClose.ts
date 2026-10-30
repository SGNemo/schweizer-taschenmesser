import { useEffect, useId, useRef } from 'react';
import { pushBack, releaseBack, type BackResult } from './backStack';

/**
 * While `open`, "Back" (Android gesture, browser button) calls `onBack` instead of leaving the page.
 * `onBack` answers `'keep'` when the element stays open (a "discard?" question appeared).
 */
export function useBackClose(open: boolean, onBack: () => BackResult): void {
  const id = useId();
  const latest = useRef(onBack);
  useEffect(() => {
    latest.current = onBack;
  });
  useEffect(() => {
    if (!open) return;
    pushBack(id, () => latest.current());
    return () => releaseBack(id);
  }, [open, id]);
}
