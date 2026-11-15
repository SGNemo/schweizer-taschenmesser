import { mailModify, mailTrash, mailUntrash } from '@/core/mail/service';
import type { MailAccountRef, ThreadChange } from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { patchCachedThread } from './cache';

/**
 * Changes a user can make to threads, one or many at once. Each has its exact undo; nothing here is
 * permanent (the trash keeps mail 30 days at the service, spam can be taken back).
 */
export type MailAction =
  | 'read'
  | 'unread'
  | 'star'
  | 'unstar'
  | 'important'
  | 'unimportant'
  | 'archive'
  | 'spam'
  | 'notSpam'
  | 'trash'
  | 'untrash';

/** How a step reaches the service: a label change, or the trash endpoints (Gmail moves to the trash only through them). */
type Call = 'modify' | 'trash' | 'untrash';

export interface Step {
  call: Call;
  /** What the step does to the thread's labels (also mirrored into the local cache). */
  change: ThreadChange;
  undoCall: Call;
  undo: ThreadChange;
  /** The thread leaves the current view (archive, trash, spam): an open thread goes back to the list. */
  leaves: boolean;
  /** `always`: asks first (trash, spam); `moves`: asks when the setting „Vor dem Verschieben fragen“ is on. */
  asks: 'always' | 'moves' | 'never';
}

const modify = (change: ThreadChange, undo: ThreadChange, extra: Partial<Step> = {}): Step => ({
  call: 'modify',
  change,
  undoCall: 'modify',
  undo,
  leaves: false,
  asks: 'never',
  ...extra,
});

export const STEPS: Record<MailAction, Step> = {
  read: modify({ removeLabelIds: ['UNREAD'] }, { addLabelIds: ['UNREAD'] }),
  unread: modify({ addLabelIds: ['UNREAD'] }, { removeLabelIds: ['UNREAD'] }),
  star: modify({ addLabelIds: ['STARRED'] }, { removeLabelIds: ['STARRED'] }),
  unstar: modify({ removeLabelIds: ['STARRED'] }, { addLabelIds: ['STARRED'] }),
  important: modify({ addLabelIds: ['IMPORTANT'] }, { removeLabelIds: ['IMPORTANT'] }),
  unimportant: modify({ removeLabelIds: ['IMPORTANT'] }, { addLabelIds: ['IMPORTANT'] }),
  archive: modify(
    { removeLabelIds: ['INBOX'] },
    { addLabelIds: ['INBOX'] },
    { leaves: true, asks: 'moves' },
  ),
  spam: modify(
    { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] },
    { addLabelIds: ['INBOX'], removeLabelIds: ['SPAM'] },
    { leaves: true, asks: 'always' },
  ),
  notSpam: modify(
    { addLabelIds: ['INBOX'], removeLabelIds: ['SPAM'] },
    { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] },
    { leaves: true },
  ),
  trash: {
    call: 'trash',
    change: { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] },
    undoCall: 'untrash',
    undo: { addLabelIds: ['INBOX'], removeLabelIds: ['TRASH'] },
    leaves: true,
    asks: 'always',
  },
  untrash: {
    call: 'untrash',
    change: { removeLabelIds: ['TRASH'] },
    undoCall: 'trash',
    undo: { addLabelIds: ['TRASH'] },
    leaves: true,
    asks: 'never',
  },
};

/** Adding or removing one of the user's own labels. */
export const labelStep = (labelId: string, add: boolean): Step =>
  add
    ? modify({ addLabelIds: [labelId] }, { removeLabelIds: [labelId] })
    : modify({ removeLabelIds: [labelId] }, { addLabelIds: [labelId] });

/** Does this step ask before it runs? */
export const asksFirst = (step: Step, confirmMoves: boolean): boolean =>
  step.asks === 'always' || (step.asks === 'moves' && confirmMoves);

/** Applies a label change to a list of label ids (the thread view keeps its own copy current). */
export function applyChange(labelIds: readonly string[], change: ThreadChange): string[] {
  const next = new Set(labelIds);
  for (const l of change.removeLabelIds ?? []) next.delete(l);
  for (const l of change.addLabelIds ?? []) next.add(l);
  return [...next];
}

/** The way back of a label change. */
export const inverse = (c: ThreadChange): ThreadChange => ({
  addLabelIds: c.removeLabelIds,
  removeLabelIds: c.addLabelIds,
});

/**
 * The part of `change` that really changes a thread with these labels: only labels it lacks are added,
 * only labels it has are removed. `undefined` when nothing would change (the thread is skipped, and its
 * undo cannot touch it).
 */
export function deltaFor(
  labelIds: readonly string[],
  change: ThreadChange,
): ThreadChange | undefined {
  const add = (change.addLabelIds ?? []).filter((l) => !labelIds.includes(l));
  const remove = (change.removeLabelIds ?? []).filter((l) => labelIds.includes(l));
  if (add.length === 0 && remove.length === 0) return undefined;
  return {
    ...(add.length ? { addLabelIds: add } : {}),
    ...(remove.length ? { removeLabelIds: remove } : {}),
  };
}

/** A thread and its labels as the user saw them when acting. */
export interface Target {
  id: string;
  labelIds: readonly string[];
}

/** What one thread had done to it: exactly this delta, taken back by its inverse. */
export interface Done {
  id: string;
  delta: ThreadChange;
}

async function perform(
  account: MailAccountRef,
  threadId: string,
  call: Call,
  change: ThreadChange,
) {
  if (call === 'trash') await mailTrash(account, threadId);
  else if (call === 'untrash') await mailUntrash(account, threadId);
  else await mailModify(account, threadId, change);
}

/** At most this many calls at a time: a batch stays far inside Gmail's per-user quota. */
const PARALLEL = 4;

async function forEach<T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker));
}

/** Mirrors a change that went through into the local cache; a cache hiccup never hides that the mailbox changed. */
async function mirror(accountKey: string, threadId: string, change: ThreadChange) {
  try {
    await patchCachedThread(accountKey, threadId, change);
  } catch {
    // the next fetch brings the cache in line
  }
}

/**
 * Runs `step` on every thread that it would change; threads it would not change are `skipped` and never
 * touched. Resolves with what each changed thread had done to it, in the order the user saw.
 */
export async function applyStep(
  account: MailAccountRef,
  targets: readonly Target[],
  step: Step,
): Promise<{ done: Done[]; skipped: string[]; failed: string[]; error?: unknown }> {
  const done: Done[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  let error: unknown;
  await forEach(targets, async ({ id, labelIds }) => {
    const delta = deltaFor(labelIds, step.change);
    if (!delta) {
      skipped.push(id);
      return;
    }
    try {
      await perform(account, id, step.call, delta);
    } catch (e) {
      error ??= e;
      failed.push(id);
      return;
    }
    await mirror(account.key, id, delta);
    done.push({ id, delta });
  });
  const order = targets.map((x) => x.id);
  done.sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id));
  return { done, skipped, failed: order.filter((id) => failed.includes(id)), error };
}

/** Takes back exactly what `applyStep` did; resolves with the threads that are back. */
export async function undoStep(
  account: MailAccountRef,
  done: readonly Done[],
  step: Step,
): Promise<{ ok: string[]; failed: string[] }> {
  const ok: string[] = [];
  const failed: string[] = [];
  await forEach(done, async ({ id, delta }) => {
    const back = inverse(delta);
    try {
      await perform(account, id, step.undoCall, back);
    } catch {
      failed.push(id);
      return;
    }
    await mirror(account.key, id, back);
    ok.push(id);
  });
  return { ok, failed };
}

/**
 * Runs a change on one or many threads and says what happened in a toast with „Rückgängig“: the undo
 * takes back exactly what changed on each thread, nothing more. A partial failure says how many went
 * through; the rest stays as it was. Resolves with the threads that changed and the first error, if any.
 */
export async function runStep(
  account: MailAccountRef,
  targets: readonly Target[],
  step: Step,
  text: (n: number) => string,
  onChanged: (direction: 'do' | 'undo', ids: string[]) => void,
): Promise<{ ok: string[]; error?: unknown }> {
  const toast = useUiStore.getState().toast;
  if (targets.length === 0) return { ok: [] };
  const { done, skipped, failed, error } = await applyStep(account, targets, step);
  // Only threads that really changed are counted; the rest were already so (or are unchanged).
  if (done.length + skipped.length === 0) {
    toast(t.mail.write.failed);
    return { ok: [], error };
  }
  const ids = done.map((d) => d.id);
  if (ids.length) onChanged('do', ids);
  const message = failed.length
    ? t.mail.batch.partial(failed.length)
    : done.length === 0
      ? t.mail.batch.unchanged
      : text(done.length);
  toast(
    message,
    done.length
      ? {
          label: t.mail.write.undo,
          run: () =>
            void (async () => {
              const back = await undoStep(account, done, step);
              if (back.ok.length) onChanged('undo', back.ok);
              toast(back.failed.length ? t.mail.write.failed : t.mail.write.undone);
            })(),
        }
      : undefined,
  );
  return { ok: [...ids, ...skipped], error };
}

/** The toast text of an action: the single wording for one thread, a count for many. */
export function doneText(action: MailAction): (n: number) => string {
  const one = t.mail.write.done;
  const many = t.mail.batch.done;
  const single: Record<MailAction, string> = {
    read: one.read,
    unread: one.unread,
    star: one.starred,
    unstar: one.unstarred,
    important: one.important,
    unimportant: one.unimportant,
    archive: one.archived,
    spam: one.spam,
    notSpam: one.notSpam,
    trash: one.trashed,
    untrash: one.restored,
  };
  return (n) => (n === 1 ? single[action] : many[action](n));
}
