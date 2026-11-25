import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * A jump into a filtered view (`?view=<word>`, planner hub 2 package 2: „In Rechnungen ansehen“ from a pile). The
 * parameter is untrusted: only a word of `allowed` reaches `onView`, anything else is ignored. It is read once and
 * leaves the URL either way, so a reload or „back“ does not apply it again. Nothing is written.
 */
export function useViewParam<V extends string>(
  allowed: readonly V[],
  onView: (view: V) => void,
): void {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const latest = useRef(onView);
  useEffect(() => {
    latest.current = onView;
  });
  useEffect(() => {
    if (raw === null) return;
    if ((allowed as readonly string[]).includes(raw)) latest.current(raw as V);
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('view');
        return next;
      },
      { replace: true },
    );
    // `allowed` is a fixed list of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, setParams]);
}
