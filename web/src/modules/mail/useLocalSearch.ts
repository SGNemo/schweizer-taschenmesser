import { useEffect, useState } from 'react';
import { searchLocal, type LocalResult } from './searchIndex';

/**
 * The search on this device for the mail page: runs when the query (or `tick`, a reload) changes. `undefined`
 * while there is no query or a new search is being built (a reload keeps the last hits); the index stays in memory (`searchIndex.ts`).
 */
export function useLocalSearch(
  accountKey: string | undefined,
  query: string,
  tick: number,
): LocalResult | undefined {
  const q = query.trim();
  const same = `${accountKey}|${q}`;
  const req = `${same}|${tick}`;
  const [state, setState] = useState<
    { same: string; req: string; result: LocalResult } | undefined
  >();
  useEffect(() => {
    if (!accountKey || !q) return;
    let alive = true;
    void searchLocal(accountKey, q)
      .then((result) => alive && setState({ same, req, result }))
      .catch(
        () =>
          alive &&
          setState({ same, req, result: { hits: [], terms: [], unsupported: [], searched: 0 } }),
      );
    return () => {
      alive = false;
    };
  }, [accountKey, q, same, req]);
  // A reload of the same search (after a row action) keeps the hits on screen until the new ones are there.
  return q && state?.same === same ? state.result : undefined;
}
