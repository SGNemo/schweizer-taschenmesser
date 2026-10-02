import type { AttentionSource } from '@/core/modules/types';
import { t } from '@/strings';
import { taskRepo } from './repo';

/** Overdue ToDos (danger) and ToDos due today (accent). */
const source: AttentionSource = async ({ today }) => {
  const open = (await taskRepo.active().toArray()).filter(
    (x) => !x.done && x.dueDate && !x.someday,
  );
  const overdue = open.filter((x) => x.dueDate! < today).length;
  const due = open.filter((x) => x.dueDate === today).length;
  return [
    ...(overdue
      ? [
          {
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
