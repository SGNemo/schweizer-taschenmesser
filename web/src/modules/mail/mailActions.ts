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

/** Runs `step` on every thread (`undo`: its way back); resolves with the threads that changed. */
export async function applyStep(
  account: MailAccountRef,
  threadIds: readonly string[],
  step: Step,
  direction: 'do' | 'undo' = 'do',
): Promise<{ ok: string[]; failed: string[]; error?: unknown }> {
  const call = direction === 'do' ? step.call : step.undoCall;
  const change = direction === 'do' ? step.change : step.undo;
  const ok: string[] = [];
  const failed: string[] = [];
  let error: unknown;
  let next = 0;
  const worker = async () => {
    while (next < threadIds.length) {
      const id = threadIds[next++]!;
      try {
        await perform(account, id, call, change);
        await patchCachedThread(account.key, id, change);
        ok.push(id);
      } catch (e) {
        error ??= e;
        failed.push(id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, threadIds.length) }, worker));
  // Keep the order the user saw.
  const order = (ids: string[]) => threadIds.filter((id) => ids.includes(id));
  return { ok: order(ok), failed: order(failed), error };
}

/**
 * Runs a change on one or many threads and says what happened in a toast with „Rückgängig“: the undo
 * takes back exactly the threads that changed. A partial failure says how many went through; the rest
 * stays as it was. Resolves with the threads that changed and the first error, if any.
 */
export async function runStep(
  account: MailAccountRef,
  threadIds: readonly string[],
  step: Step,
  done: (n: number) => string,
  onChanged: (direction: 'do' | 'undo', ids: string[]) => void,
): Promise<{ ok: string[]; error?: unknown }> {
  const toast = useUiStore.getState().toast;
  if (threadIds.length === 0) return { ok: [] };
  const { ok, failed, error } = await applyStep(account, threadIds, step);
  if (ok.length === 0) {
    toast(t.mail.write.failed);
    return { ok, error };
  }
  onChanged('do', ok);
  toast(failed.length ? t.mail.batch.partial(ok.length, threadIds.length) : done(ok.length), {
    label: t.mail.write.undo,
    run: () =>
      void (async () => {
        const back = await applyStep(account, ok, step, 'undo');
        if (back.ok.length) onChanged('undo', back.ok);
        toast(back.failed.length ? t.mail.write.failed : t.mail.write.undone);
      })(),
  });
  return { ok, error };
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
