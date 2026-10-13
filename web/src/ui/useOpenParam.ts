import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Deep link to a record: `?open=<id>` (what a search hit or an assistant answer links to). Once the
 * page is mounted the record is loaded and handed to `onOpen` (usually its edit dialog), and the
 * parameter is removed so a reload or "back" does not open it again. `onOpen` may return URL
 * parameters to set instead (a page that shows records through its URL, like `?person=<id>`). An id that no longer exists is
 * dropped silently: the module page itself is still the right place to land.
 */
export function useOpenParam<T>(
  load: (id: string) => Promise<T | undefined>,
  onOpen: (record: T) => void | Record<string, string>,
): void {
  const [params, setParams] = useSearchParams();
  const id = params.get('open');
  const latest = useRef({ load, onOpen });
  useEffect(() => {
    latest.current = { load, onOpen };
  });
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void latest.current
      .load(id)
      .catch(() => undefined)
      .then((record) => {
        if (cancelled) return;
        const extra = record ? latest.current.onOpen(record) : undefined;
        setParams(
          (p) => {
            const next = new URLSearchParams(p);
            next.delete('open');
            for (const [k, v] of Object.entries(extra ?? {})) next.set(k, v);
            return next;
          },
          { replace: true },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [id, setParams]);
}
