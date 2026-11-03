import { mailModify } from '@/core/mail/service';
import type { MailAccountRef, ThreadChange } from '@/core/mail/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { patchCachedThread } from './cache';

export type RowAction = 'read' | 'unread' | 'archive';

const CHANGES: Record<RowAction, { change: ThreadChange; undo: ThreadChange; done: () => string }> =
  {
    read: {
      change: { removeLabelIds: ['UNREAD'] },
      undo: { addLabelIds: ['UNREAD'] },
      done: () => t.mail.write.done.read,
    },
    unread: {
      change: { addLabelIds: ['UNREAD'] },
      undo: { removeLabelIds: ['UNREAD'] },
      done: () => t.mail.write.done.unread,
    },
    archive: {
      change: { removeLabelIds: ['INBOX'] },
      undo: { addLabelIds: ['INBOX'] },
      done: () => t.mail.write.done.archived,
    },
  };

/**
 * One-click change to a thread straight from the list (mark read/unread, archive): applied at the service,
 * mirrored in the local cache, with an undo in the toast. Nothing is permanent; the trash stays in the thread
 * view where it asks first.
 */
export async function rowAction(
  account: MailAccountRef,
  threadId: string,
  action: RowAction,
  onChanged: () => void,
): Promise<void> {
  const toast = useUiStore.getState().toast;
  const { change, undo, done } = CHANGES[action];
  try {
    await mailModify(account, threadId, change);
  } catch {
    toast(t.mail.write.failed);
    return;
  }
  await patchCachedThread(account.key, threadId, change);
  onChanged();
  toast(done(), {
    label: t.mail.write.undo,
    run: () =>
      void (async () => {
        try {
          await mailModify(account, threadId, undo);
          await patchCachedThread(account.key, threadId, undo);
          onChanged();
          toast(t.mail.write.undone);
        } catch {
          toast(t.mail.write.failed);
        }
      })(),
  });
}
