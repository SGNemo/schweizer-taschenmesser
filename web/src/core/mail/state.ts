/** Device-local notification state per mailbox (`_meta`, never synced): watermark and open batches, ids and times only. */
import { getLocal, setLocal } from '@/core/connectors/state';
import { emptyNotifyState, type NotifyState } from './notify';

const key = (accountKey: string) => `mail.notify.${accountKey}`;

export async function loadNotifyState(accountKey: string): Promise<NotifyState> {
  return { ...emptyNotifyState(), ...(await getLocal<NotifyState>(key(accountKey))) };
}
export const saveNotifyState = (accountKey: string, state: NotifyState): Promise<void> =>
  setLocal(key(accountKey), state);
export const clearNotifyState = (accountKey: string): Promise<void> =>
  setLocal(key(accountKey), undefined);
