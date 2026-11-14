import { useCallback, useEffect, useState } from 'react';
import { FIRST_READ_HOLD_MS } from '@/core/status/settled';

/**
 * The hold of an entry page with `identity.firstRead` (0b-8): its hint above the head (the weather's severe-weather
 * hint) or its stage and page (music) are built from its first reads: `held` for `key` (the route; `undefined` =
 * nothing to wait for) from the first paint until the page calls `settle` or `FIRST_READ_HOLD_MS` have passed (a read
 * that hangs, a slow network), counted again for every key. While it holds, the frame lays the notice, the head and the
 * page out without painting them. `late` is true once the bound ended the hold before the page settled; it stays true
 * for that key (that visit), so the page keeps its late layout even when the reads come back afterwards – also for
 * another `?place=` of the weather, and on a slow machine whose normal reads take longer than the bound (no shift
 * either way; the next visit is on time again).
 */
export function useFirstReadHold(
  key: string | undefined,
): [held: boolean, settle: () => void, late: boolean] {
  const [state, setState] = useState({ key, done: false, late: false });
  // A new route holds again in the same render.
  if (state.key !== key) setState({ key, done: false, late: false });
  const settle = useCallback(() => setState((s) => (s.done ? s : { ...s, done: true })), []);
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(
      () => setState((s) => (s.key === key && !s.done ? { ...s, done: true, late: true } : s)),
      FIRST_READ_HOLD_MS,
    );
    return () => clearTimeout(timer);
  }, [key]);
  const current = state.key === key;
  return [!!key && !(current && state.done), settle, !!key && current && state.late];
}
