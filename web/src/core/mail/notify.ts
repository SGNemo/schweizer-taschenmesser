/**
 * New-mail notifications, the pure part: which threads count as new, how polls are spaced, how a batch
 * becomes one notification. Everything here works on ids and times; no mail text, no network, no storage.
 * The poller and the notification source live in `modules/mail`.
 */
import type { MailThreadSummary } from './types';

export interface NotifyBatch {
  /** When the poll found them (epoch ms): the notification's time. */
  at: number;
  /** Thread ids (never subjects or senders). */
  ids: string[];
}

export interface NotifyState {
  /** Newest thread time seen so far; only unread threads newer than this are "new". */
  watermark?: number;
  batches: NotifyBatch[];
  lastPoll?: number;
  /** Failed polls in a row (token gone, offline): the interval doubles, at most ×8. */
  failures: number;
}

export const emptyNotifyState = (): NotifyState => ({ batches: [], failures: 0 });

/** Poll intervals the user can choose (minutes). Not shorter than five: Gmail is not a chat. */
export const NOTIFY_INTERVALS = [5, 15, 30, 60] as const;
export type NotifyInterval = (typeof NOTIFY_INTERVALS)[number];

const BATCH_KEEP_MS = 48 * 60 * 60 * 1000;
const MAX_IDS = 50;

/**
 * Folds one poll into the state. The very first poll only sets the watermark (nobody wants "40 new mails"
 * the moment they switch the setting on). Unread threads newer than the watermark that are not in a batch
 * yet make one new batch; read or older ones never do.
 */
export function applyPoll(
  state: NotifyState,
  threads: readonly MailThreadSummary[],
  at: number,
): { state: NotifyState; fresh: string[] } {
  const newest = threads.reduce((m, t) => Math.max(m, t.date), state.watermark ?? 0);
  const kept = state.batches.filter((b) => b.at > at - BATCH_KEEP_MS);
  const base: NotifyState = {
    ...state,
    batches: kept,
    watermark: state.watermark === undefined ? Math.max(newest, 0) || at : newest,
    lastPoll: at,
    failures: 0,
  };
  if (state.watermark === undefined) return { state: base, fresh: [] };
  const known = new Set(kept.flatMap((b) => b.ids));
  const seen = new Set<string>();
  const fresh: string[] = [];
  for (const t of threads) {
    if (!t.unread || t.date <= state.watermark || known.has(t.id) || seen.has(t.id)) continue;
    seen.add(t.id);
    fresh.push(t.id);
  }
  if (fresh.length === 0) return { state: base, fresh };
  return {
    state: { ...base, batches: [...kept, { at, ids: fresh.slice(0, MAX_IDS) }] },
    fresh,
  };
}

/** A failed poll: spaced further out next time, nothing else changes. */
export const afterFailure = (state: NotifyState, at: number): NotifyState => ({
  ...state,
  lastPoll: at,
  failures: state.failures + 1,
});

/** Is it time to look again? The wait doubles with each failure in a row (×8 at most). */
export function pollDue(state: NotifyState, intervalMinutes: number, at: number): boolean {
  if (state.lastPoll === undefined) return true;
  const factor = 2 ** Math.min(state.failures, 3);
  return at - state.lastPoll >= intervalMinutes * 60_000 * factor;
}

export interface NotifyText {
  title: string;
  body?: string;
}

/**
 * One notification per batch, counted over the threads that are still unread (read it elsewhere meanwhile
 * and nothing pings). No count, no notification. Names only when the user asked for them.
 */
export function summarize(
  batch: NotifyBatch,
  unread: ReadonlySet<string>,
  text: { title: (n: number) => string; senders: (names: string[], more: number) => string },
  names?: ReadonlyMap<string, string>,
): NotifyText | undefined {
  const ids = batch.ids.filter((id) => unread.has(id));
  if (ids.length === 0) return undefined;
  if (!names) return { title: text.title(ids.length) };
  const unique = [...new Set(ids.map((id) => names.get(id)).filter((n): n is string => !!n))];
  const shown = unique.slice(0, 3);
  return {
    title: text.title(ids.length),
    body: shown.length ? text.senders(shown, unique.length - shown.length) : undefined,
  };
}
