import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { invoiceIds, invoiceOffers, type InvoiceOffer, type InvoiceThread } from './invoiceRow';

const NONE: ReadonlyMap<string, InvoiceOffer> = new Map();

/**
 * The invoice offers of the listed rows, live: a written, noted or deleted invoice changes the row at once.
 * Empty while the invoices module is off or `enabled` is false (the setting „Rechnungen in der Liste
 * erkennen“); `undefined` while it is still reading – then nothing may claim „nothing to add“.
 */
export function useInvoiceOffers(
  threads: readonly InvoiceThread[],
  enabled: boolean,
): ReadonlyMap<string, InvoiceOffer> | undefined {
  const states = useModuleStates();
  const on = enabled && !!states?.invoices;
  // A key of what the reading depends on, so the ids are hashed only when the rows change.
  const key = useMemo(
    () =>
      on
        ? threads
            .map((th) => {
              const wrote = th.labelIds.includes('SENT') || th.labelIds.includes('DRAFT');
              // Subject and preview too: the values a tap writes are read from them.
              return `${th.id}:${th.lastMessageId ?? ''}:${wrote ? 1 : 0}:${th.subject}:${th.snippet}`;
            })
            .join('|')
        : '',
    [threads, on],
  );
  const [ids, setIds] = useState<{ key: string; ids: Map<string, string> }>();
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void invoiceIds(threads).then((m) => alive && setIds({ key, ids: m }));
    return () => {
      alive = false;
    };
    // `threads` is captured with its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const ready = on && ids?.key === key ? ids.ids : undefined;
  // The result carries the key it was read for: a result of the previous rows is never handed out.
  const result = useLiveQuery(
    () =>
      ready
        ? invoiceOffers(threads, ready).then((offers) => ({ key, offers }))
        : Promise.resolve(undefined),
    [ready],
  );
  if (!states) return undefined; // module states still loading
  if (!on || threads.length === 0) return NONE;
  return ready && result?.key === key ? result.offers : undefined;
}
