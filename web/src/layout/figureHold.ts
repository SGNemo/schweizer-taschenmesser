import { useCallback, useEffect, useState } from 'react';

/**
 * How long after the page arrived the frame keeps the head row's room while the page reads its data (U01). Pages fill
 * the figure within a few frames; a page without one gives the room back after this.
 */
export const FIGURE_HOLD_MS = 1000;

/**
 * The hold of the head row's room (U01): true from the first paint, while the page's chunk loads (`setLoading`) and
 * for `FIGURE_HOLD_MS` after it arrived – counted again for every `key` (route and layout), so moving between two
 * routes of one module (the frame stays mounted, the chunk may be cached) never measures the new route before its
 * page has filled the row.
 */
export function useFigureHold(key: string | undefined): [boolean, (loading: boolean) => void] {
  const [loading, setLoadingState] = useState(false);
  // The key whose hold has run out; any other key (a new route) holds again in the same render.
  const [elapsedFor, setElapsedFor] = useState<string | undefined>();
  const setLoading = useCallback((next: boolean) => {
    setLoadingState(next);
    if (next) setElapsedFor(undefined);
  }, []);
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => setElapsedFor(key), FIGURE_HOLD_MS);
    return () => clearTimeout(timer);
  }, [loading, key]);
  return [loading || elapsedFor !== key, setLoading];
}
