import type { DueNotification } from '@/core/modules/types';
import { t } from '@/strings';
import { getFocusSession } from './state';

/** The end of a running focus round as a notification, so the OS can announce it with the app closed. */
export async function focusEndDue(): Promise<DueNotification[]> {
  const s = await getFocusSession();
  if (!s || s.endAt === undefined || s.announced) return [];
  return [
    {
      key: `focus:${s.taskId}:${s.endAt}`,
      at: s.endAt,
      title: t.focus.mode.notifyTitle,
      body: s.title,
      url: s.path ?? '/',
    },
  ];
}
