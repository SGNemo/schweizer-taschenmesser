import type { AttentionSource } from '@/core/modules/types';
import { getFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { taskRepo } from './repo';

/**
 * ToDos due today (accent) and ToDos whose date passed. By default ("ruhiges Jetzt wichtig") the
 * old ones are "waiting" (warning tone, no day counter); with the setting off they are overdue (danger).
 */
const source: AttentionSource = async ({ today }) => {
  const open = (await taskRepo.active().toArray()).filter(
    (x) => !x.done && x.dueDate && !x.someday && !x.parentId,
  );
  const overdue = open.filter((x) => x.dueDate! < today).length;
  const due = open.filter((x) => x.dueDate === today).length;
  const { calmAttention } = await getFocusSettings();
  return [
    ...(overdue
      ? [
          calmAttention
            ? {
                id: 'todos:waiting',
                tone: 'warning' as const,
                icon: 'checklist' as const,
                title: t.attention.todosWaiting(overdue),
                detail: t.attention.todosWaitingDetail,
                to: '/todos',
                rank: 2,
              }
            : {
                id: 'todos:overdue',
                tone: 'danger' as const,
                icon: 'checklist' as const,
                title: t.attention.todosOverdue(overdue),
                to: '/todos',
                rank: 2,
              },
        ]
      : []),
    ...(due
      ? [
          {
            id: 'todos:today',
            tone: 'accent' as const,
            icon: 'checklist' as const,
            title: t.attention.todosToday(due),
            to: '/todos',
            rank: 2,
          },
        ]
      : []),
  ];
};

export default source;
