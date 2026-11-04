/**
 * Looks for new mail in the background (read permission only, nothing is changed at the service) and keeps
 * the batches the notification source tells about. Off unless the user switched it on; one look per
 * interval and mailbox; failures slow it down instead of hammering. It never sends or changes anything.
 */
import { listMailAccounts } from '@/core/mail/accounts';
import { afterFailure, applyPoll, pollDue, type NotifyState } from '@/core/mail/notify';
import { mailThreads } from '@/core/mail/service';
import { loadNotifyState, saveNotifyState } from '@/core/mail/state';
import type { MailAccountRef, MailPage, MailThreadSummary } from '@/core/mail/types';
import { getSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { reportInvoices } from './automationEvents';
import { saveThreads } from './cache';
import { settings, type MailSettings } from './settings';

const CHECK_EVERY_MS = 60_000;
const FIRST_CHECK_MS = 20_000;
/** Threads looked at per label and look: enough for a quiet inbox, light on the quota. */
const PAGE = 10;

export interface PollDeps {
  settings(): Promise<MailSettings>;
  accounts(): Promise<MailAccountRef[]>;
  threads(account: MailAccountRef, labelId: string): Promise<MailPage>;
  load(accountKey: string): Promise<NotifyState>;
  save(accountKey: string, state: NotifyState): Promise<void>;
  /** Keeps the saved headers (and so the widget and the list) up to date with what was read. */
  saveHeaders(accountKey: string, threads: MailThreadSummary[]): Promise<void>;
  now(): number;
}

export function defaultDeps(): PollDeps {
  return {
    settings: async () =>
      (await getSettings('module.mail', settings.schema, settings.defaults)) as MailSettings,
    accounts: listMailAccounts,
    threads: (account, labelId) => mailThreads(account, { labelIds: [labelId], max: PAGE }),
    load: loadNotifyState,
    save: saveNotifyState,
    saveHeaders: saveThreads,
    now,
  };
}

/** One round over all mailboxes that are due. Returns how many were looked at. */
export async function pollAll(deps: PollDeps = defaultDeps()): Promise<number> {
  const prefs = await deps.settings();
  if (!prefs.notify) return 0; // off: no network, nothing
  const every = Number(prefs.notifyEvery);
  const labels = prefs.notifyLabels.length > 0 ? prefs.notifyLabels : ['INBOX'];
  let looked = 0;
  for (const account of await deps.accounts()) {
    if (!account.features?.includes('mail')) continue;
    const state = await deps.load(account.key);
    const at = deps.now();
    if (!pollDue(state, every, at)) continue;
    looked += 1;
    try {
      const pages = await Promise.all(labels.map((l) => deps.threads(account, l)));
      const byId = new Map(pages.flatMap((p) => p.threads).map((t) => [t.id, t]));
      const threads = [...byId.values()];
      await deps.saveHeaders(account.key, threads);
      const polled = applyPoll(state, threads, at);
      await deps.save(account.key, polled.state);
      reportInvoices(threads.filter((t) => polled.fresh.includes(t.id)));
    } catch {
      // token gone, offline, rate limit: the mail page explains it; here we only wait longer
      await deps.save(account.key, afterFailure(state, at));
    }
  }
  return looked;
}

/** Starts the loop (module service): a quiet check every minute whether a look is due. */
export default function start(): () => void {
  let busy = false;
  const tick = () => {
    if (busy) return;
    busy = true;
    void pollAll()
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  };
  const first = setTimeout(tick, FIRST_CHECK_MS);
  const timer = setInterval(tick, CHECK_EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
