import type { CalendarSource } from '@/core/modules/types';
import { notDeleted } from '@/core/db/repo';
import { taskRepo } from './repo';

/** Tasks with a due date appear on the calendar. */
const source: CalendarSource = async (range) => {
  const tasks = await taskRepo.table
    .where('dueDate')
    .between(range.from, range.to, true, true)
    .filter(notDeleted)
    .toArray();
  return tasks.map((t) => ({
    id: t.id,
    source: 'todos',
    kind: 'task',
    title: t.title,
    date: t.dueDate!,
    allDay: true,
    done: t.done,
    to: '/todos',
  }));
};

export default source;
