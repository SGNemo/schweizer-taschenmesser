import { useCallback, useEffect, useState } from 'react';
import { ConnectorError } from '@/core/connectors/types';
import { mailThreads } from '@/core/mail/service';
import type { MailAccountRef, MailErrorCode } from '@/core/mail/types';
import { DEMO_ACCOUNT, loadThreads, saveThreads, type CachedThreadView } from './cache';

export interface MailboxState {
  threads: CachedThreadView[];
  loading: boolean;
  error?: MailErrorCode;
  /** The list shown is the saved state because the network call failed. */
  fromCache: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

const codeOf = (e: unknown): MailErrorCode =>
  e instanceof ConnectorError &&
  (e.code === 'expired' || e.code === 'denied' || e.code === 'rate-limited')
    ? e.code
    : 'network';

interface Loaded {
  /** Which request this state answers; anything else is stale and shows as "loading". */
  req: string;
  threads: CachedThreadView[];
  loading: boolean;
  error?: MailErrorCode;
  fromCache: boolean;
  next?: string;
}

const fresh = (req: string): Loaded => ({ req, threads: [], loading: true, fromCache: false });

/**
 * Threads of one account for a label or a search. The saved headers show first (a label view, no search),
 * then the service answers and replaces them. Searches are never saved.
 */
export function useMailbox(
  account: MailAccountRef | undefined,
  labelId: string,
  query: string,
): MailboxState {
  const [tick, setTick] = useState(0);
  const key = account?.key;
  const q = query.trim();
  const req = `${key}|${labelId}|${q}|${tick}`;
  const [state, setState] = useState<Loaded>(() => fresh(req));
  const current = state.req === req ? state : fresh(req);

  useEffect(() => {
    if (!account) return;
    let alive = true;
    const set = (patch: Partial<Loaded>) =>
      alive && setState((old) => ({ ...(old.req === req ? old : fresh(req)), ...patch }));
    void (async () => {
      const cached = q ? [] : await loadThreads(account.key, { labelId });
      set({ threads: cached });
      if (account.key === DEMO_ACCOUNT) return set({ loading: false });
      try {
        const page = await mailThreads(account, {
          query: q || undefined,
          labelIds: !q && labelId ? [labelId] : undefined,
        });
        if (!q) await saveThreads(account.key, page.threads);
        set({
          threads: page.threads.map((t) => ({ ...t, demo: false })),
          next: page.nextPageToken,
          loading: false,
          error: undefined,
          fromCache: false,
        });
      } catch (e) {
        set({ error: codeOf(e), fromCache: cached.length > 0, loading: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [account, key, labelId, q, req]);

  const loadMore = useCallback(() => {
    if (!account || !current.next) return;
    const pageToken = current.next;
    setState((old) => ({ ...old, loading: true }));
    void mailThreads(account, {
      query: q || undefined,
      labelIds: !q && labelId ? [labelId] : undefined,
      pageToken,
    })
      .then(async (page) => {
        if (!q) await saveThreads(account.key, page.threads);
        setState((old) =>
          old.req !== req
            ? old
            : {
                ...old,
                threads: [...old.threads, ...page.threads.map((t) => ({ ...t, demo: false }))],
                next: page.nextPageToken,
                loading: false,
              },
        );
      })
      .catch((e: unknown) =>
        setState((old) => (old.req !== req ? old : { ...old, error: codeOf(e), loading: false })),
      );
  }, [account, labelId, q, req, current.next]);

  return {
    threads: current.threads,
    loading: current.loading,
    error: current.error,
    fromCache: current.fromCache,
    hasMore: current.next !== undefined,
    loadMore,
    reload: () => setTick((n) => n + 1),
  };
}
