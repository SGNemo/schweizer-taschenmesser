import type { MailAccountRef } from '@/core/mail/types';
import { doneText, runStep, STEPS, type MailAction, type Target } from './mailActions';

export type RowAction = Extract<MailAction, 'read' | 'unread' | 'archive' | 'star' | 'unstar'>;

/**
 * One-click change to a thread straight from the list (mark read/unread, star, archive): applied at the
 * service, mirrored in the local cache, with an undo in the toast. Nothing is permanent; the trash and spam
 * stay in the thread view and the selection, where they ask first.
 */
export async function rowAction(
  account: MailAccountRef,
  thread: Target,
  action: RowAction,
  onChanged: () => void,
): Promise<void> {
  await runStep(account, [thread], STEPS[action], doneText(action), () => onChanged());
}
