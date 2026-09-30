import { useLiveQuery } from 'dexie-react-hooks';
import { relativeDayLabel, today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { compareTasks, dueTone } from '../logic';
import { taskRepo } from '../repo';

export default function OpenTasksWidget() {
  const open = useLiveQuery(
    async () => (await taskRepo.active().toArray()).filter((x) => !x.done).sort(compareTasks),
    [],
  );
  const now = today();
  return (
    <WidgetList
      loading={!open}
      empty={t.todos.widgetEmpty}
      headline={open && open.length > 0 ? t.todos.openCount(open.length) : undefined}
      entries={(open ?? []).slice(0, 5).map((task) => ({
        key: task.id,
        title: task.title,
        meta: task.dueDate ? relativeDayLabel(task.dueDate, now) : undefined,
        overdue: dueTone(task.dueDate, task.done, now) === 'overdue',
      }))}
      to="/todos"
      linkLabel={t.todos.title}
    />
  );
}
