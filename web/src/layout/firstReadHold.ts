import { useCallback, useEffect, useState } from 'react';
import { STATUS_WAIT_MS } from '@/core/status/settled';

/**
 * The hold of an entry page whose hint above the head (`identity.notice`, the weather's severe-weather hint) or whose
 * stage and page (`identity.firstRead`, music) are built from its first reads (0b-8): true for `key` (the route;
 * `undefined` = nothing to wait for) from the first paint until the page calls `settle` or `STATUS_WAIT_MS` have
 * passed (a read that hangs, a slow network), counted again for every key. While it holds, the frame lays the notice,
 * the head and the page out without painting them, so nothing that arrives with those reads pushes down what was
 * already on the screen.
 */
export function useFirstReadHold(key: string | undefined): [held: boolean, settle: () => void] {
  const [state, setState] = useState({ key, done: false });
  // A new route holds again in the same render.
  if (state.key !== key) setState({ key, done: false });
  const settle = useCallback(() => setState((s) => (s.done ? s : { ...s, done: true })), []);
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(
      () => setState((s) => (s.key === key && !s.done ? { ...s, done: true } : s)),
      STATUS_WAIT_MS,
    );
    return () => clearTimeout(timer);
  }, [key]);
  return [!!key && !(state.key === key && state.done), settle];
}
