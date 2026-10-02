import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { notDeleted } from '@/core/db/repo';
import { datesInRange } from '@/core/recurrence/expand';
import { taskRepo } from './repo';

/**
 * Tasks with a due date appear on the calendar. An open recurring task also shows its later
 * occurrences (the task itself exists once; ticking it off creates the next one).
 */
const source: CalendarSource = async (range) => {
  const tasks = await taskRepo.table
    .where('dueDate')
    .between(range.from, range.to, true, true)
    .filter((t) => notDeleted(t) && !t.someday)
    .toArray();
  const items: CalendarItem[] = tasks.map((t) => ({
    id: t.id,
    source: 'todos',
    kind: 'task',
    title: t.title,
    date: t.dueDate!,
    allDay: true,
    done: t.done,
    to: '/todos',
  }));
  const recurring = (await taskRepo.table.filter(notDeleted).toArray()).filter(
    (t) => !t.done && !t.someday && t.dueDate && t.recurrence,
  );
  for (const t of recurring) {
    for (const date of datesInRange(t.dueDate!, t.recurrence, range.from, range.to)) {
      if (date === t.dueDate) continue; // the task itself, listed above
      items.push({
        id: `${t.id}:${date}`,
        source: 'todos',
        kind: 'task',
        title: t.title,
        date,
        allDay: true,
        done: false,
        to: '/todos',
      });
    }
  }
  return items;
};

export default source;
