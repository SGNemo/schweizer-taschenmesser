import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { listMailAccounts } from '@/core/mail/accounts';
import { mailThreads } from '@/core/mail/service';
import { now } from '@/core/time/now';
import { DEMO_ACCOUNT, loadThreads, saveThreads, type CachedThreadView } from './cache';
import { looksLikeInvoice } from './format';
import { threadRepo } from './repo';

const REFRESH_EVERY = 10 * 60_000;
const INVOICE_DAYS = 30;
const lastRefresh = new Map<string, number>();

/** Refreshes the inbox headers of every connected account, at most every ten minutes. Errors are ignored. */
async function refresh(): Promise<void> {
  for (const account of await listMailAccounts()) {
    if ((lastRefresh.get(account.key) ?? 0) + REFRESH_EVERY > now()) continue;
    lastRefresh.set(account.key, now());
    try {
      const page = await mailThreads(account, { labelIds: ['INBOX'], max: 10 });
      await saveThreads(account.key, page.threads);
    } catch {
      // the widget shows the saved state; the page explains what went wrong
    }
  }
}

export interface MailSummary {
  unread: number;
  /** Unread inbox threads, "important" ones first, newest first. */
  top: CachedThreadView[];
  invoices: number;
}

/** Live data for the three widgets: reads the local cache only (plus a throttled inbox refresh). */
export function useMailSummary(): MailSummary | undefined {
  useEffect(() => {
    void refresh();
  }, []);
  return useLiveQuery(async () => {
    const keys = new Set((await threadRepo.active().toArray()).map((r) => r.accountKey));
    const real = [...keys].filter((k) => k !== DEMO_ACCOUNT);
    const accounts = real.length > 0 ? real : keys.has(DEMO_ACCOUNT) ? [DEMO_ACCOUNT] : [];
    const all = (await Promise.all(accounts.map((a) => loadThreads(a)))).flat();
    const inbox = all.filter((t) => t.labelIds.includes('INBOX'));
    const unread = inbox.filter((t) => t.unread);
    const top = [...unread].sort(
      (a, b) =>
        Number(b.labelIds.includes('IMPORTANT')) - Number(a.labelIds.includes('IMPORTANT')) ||
        b.date - a.date,
    );
    const since = now() - INVOICE_DAYS * 86_400_000;
    return {
      unread: unread.length,
      top: top.slice(0, 3),
      invoices: all.filter((t) => t.date >= since && looksLikeInvoice(t.subject, t.from)).length,
    };
  }, []);
}
