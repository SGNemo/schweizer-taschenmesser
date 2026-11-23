/**
 * „Wartet auf mich“: the mails that want something from the person, by a rule the person picks in the mail
 * settings (`waitingRule`), plus their own „Erledigt“ and „Später“ marks. Everything here is read from this
 * device: the cached headers and the marks (`localStorage`, thread ids and times only, never synced or sent).
 *
 * The planner reads only `mailQueueSummary()` – a count and a route, no subject, sender or id (planner hub 2,
 * agreed in the notes repo 2026-11-23). It wraps it in its own pile contribution; this module adds no event.
 */
import { listMailAccounts } from '@/core/mail/accounts';
import { getSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { DEMO_ACCOUNT, DEMO_EMAIL, loadThreads, type CachedThreadView } from './cache';
import { kindOf } from './kinds';
import { threadRepo } from './repo';
import { settings, type MailSettings } from './settings';

export type WaitingRule = 'reply' | 'starred' | 'off';

/** How far back „an mich, unbeantwortet“ looks: older mail is history, not a queue. */
export const QUEUE_DAYS = 30;
const DAY = 86_400_000;

/** The one route into the queue (allow-listed, read once by the mail page, never a write). */
export const QUEUE_ROUTE = '/mail?view=waiting';

/* ------------------------------------------- marks ------------------------------------------- */

/** „Erledigt“ (until a newer message comes) and „Später“ (until a time), per `accountKey|threadId`. */
export interface QueueMarks {
  done: Record<string, number>;
  later: Record<string, number>;
}

const KEY = 'tm-mail-queue';
/** Marks older than this are dropped when the marks are written (a queue never looks back further). */
const KEEP_MS = 2 * QUEUE_DAYS * DAY;

const markKey = (accountKey: string, threadId: string) => `${accountKey}|${threadId}`;

const numbers = (v: unknown): Record<string, number> =>
  v && typeof v === 'object'
    ? Object.fromEntries(
        Object.entries(v as Record<string, unknown>).filter(
          (e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]),
        ),
      )
    : {};

export function readMarks(): QueueMarks {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    return { done: numbers(v.done), later: numbers(v.later) };
  } catch {
    return { done: {}, later: {} };
  }
}

function writeMarks(marks: QueueMarks): QueueMarks {
  const at = now();
  const fresh = (r: Record<string, number>, keep: (t: number) => boolean) =>
    Object.fromEntries(Object.entries(r).filter(([, t]) => keep(t)));
  const next = {
    done: fresh(marks.done, (t) => at - t < KEEP_MS),
    later: fresh(marks.later, (t) => t > at),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the marks live until the page closes */
  }
  return next;
}

/** „Erledigt“: the mail leaves the queue until a newer message arrives in its thread. */
export const markDone = (accountKey: string, threadId: string): QueueMarks => {
  const m = readMarks();
  return writeMarks({ ...m, done: { ...m.done, [markKey(accountKey, threadId)]: now() } });
};

/** „Später“: the mail leaves the queue until tomorrow morning (06:00 local). */
export const markLater = (accountKey: string, threadId: string): QueueMarks => {
  const m = readMarks();
  const until = new Date(now());
  until.setDate(until.getDate() + 1);
  until.setHours(6, 0, 0, 0);
  return writeMarks({
    ...m,
    later: { ...m.later, [markKey(accountKey, threadId)]: until.getTime() },
  });
};

/** Undo of either mark. */
export const unmark = (accountKey: string, threadId: string): QueueMarks => {
  const m = readMarks();
  const k = markKey(accountKey, threadId);
  const { [k]: _d, ...done } = m.done;
  const { [k]: _l, ...later } = m.later;
  return writeMarks({ done, later });
};

/* ------------------------------------------- rule ------------------------------------------- */

interface RuleContext {
  rule: WaitingRule;
  marks: QueueMarks;
  accountKey: string;
  /** The account's own address: a newest message from it waits for nobody. */
  me?: string;
  at: number;
}

/**
 * Is this mail in the queue? `reply` (the default): in the inbox, not an invoice or newsletter (`kinds.ts`),
 * from a person, the newest message not the person's own, from the last 30 days. `starred`: carries the star.
 * Either way not marked „Erledigt“ since its newest message and not put off with „Später“.
 */
export function isWaiting(th: CachedThreadView, c: RuleContext): boolean {
  if (c.rule === 'off') return false;
  const k = markKey(c.accountKey, th.id);
  if ((c.marks.done[k] ?? -1) >= th.date) return false;
  if ((c.marks.later[k] ?? 0) > c.at) return false;
  if (c.rule === 'starred') return th.labelIds.includes('STARRED');
  return (
    th.labelIds.includes('INBOX') &&
    th.personal !== false &&
    !th.lastFromMe &&
    (!c.me || th.from.email.toLowerCase() !== c.me.toLowerCase()) &&
    kindOf(th) === 'other' &&
    c.at - th.date <= QUEUE_DAYS * DAY
  );
}

/** The queue of one account, newest first. */
export const waitingThreads = (
  threads: readonly CachedThreadView[],
  c: RuleContext,
): CachedThreadView[] => threads.filter((th) => isWaiting(th, c)).sort((a, b) => b.date - a.date);

/* ----------------------------------------- summary ----------------------------------------- */

export interface MailQueueSummary {
  /** Mails in the queue; 0 when mail is not connected or the queue is off. */
  count: number;
  /** Where the queue opens. */
  target: string;
}

/**
 * The count of „Wartet auf mich“ over every connected account (the demo mailbox only when none is), from the
 * device cache, without network. For the planner's pile: no content leaves this function. With several accounts
 * the count is their sum; the route opens the first account's queue (the mail page's own default).
 */
export async function mailQueueSummary(): Promise<MailQueueSummary> {
  const prefs = (await getSettings(
    'module.mail',
    settings.schema,
    settings.defaults,
  )) as MailSettings;
  // The connected accounts (a disconnected account's old cache does not count), with their own address: a
  // header refreshed in the background has lost `lastFromMe`, the sender address still tells.
  const connected = (await listMailAccounts()).map((a) => ({ key: a.key, me: a.email }));
  const demo =
    (await threadRepo.table.where('accountKey').equals(DEMO_ACCOUNT).count()) > 0
      ? [{ key: DEMO_ACCOUNT, me: DEMO_EMAIL }]
      : [];
  const accounts = connected.length > 0 ? connected : demo;
  const marks = readMarks();
  const at = now();
  let count = 0;
  for (const { key: accountKey, me } of accounts) {
    const threads = await loadThreads(accountKey, { limit: 200 });
    count += waitingThreads(threads, { rule: prefs.waitingRule, marks, accountKey, me, at }).length;
  }
  return { count, target: QUEUE_ROUTE };
}
