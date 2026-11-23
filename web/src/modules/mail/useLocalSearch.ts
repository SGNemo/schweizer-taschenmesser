import { useEffect, useState } from 'react';
import { searchLocal, type LocalResult } from './searchIndex';

/**
 * The search on this device for the mail page: runs when the query (or `tick`, a reload) changes. `undefined`
 * while there is no query or the index is being built; the index stays in memory (`searchIndex.ts`).
 */
export function useLocalSearch(
  accountKey: string | undefined,
  query: string,
  tick: number,
): LocalResult | undefined {
  const q = query.trim();
  const req = `${accountKey}|${q}|${tick}`;
  const [state, setState] = useState<{ req: string; result: LocalResult } | undefined>();
  useEffect(() => {
    if (!accountKey || !q) return;
    let alive = true;
    void searchLocal(accountKey, q)
      .then((result) => alive && setState({ req, result }))
      .catch(
        () =>
          alive && setState({ req, result: { hits: [], terms: [], unsupported: [], searched: 0 } }),
      );
    return () => {
      alive = false;
    };
  }, [accountKey, q, req]);
  return q && state?.req === req ? state.result : undefined;
}
