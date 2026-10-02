import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { compareTasks } from '../logic';
import { taskRepo } from '../repo';

export default function OpenTasksWidget() {
  const open = useLiveQuery(
    async () => (await taskRepo.active().toArray()).filter((x) => !x.done).sort(compareTasks),
    [],
  );
  const day = today();
  const overdue = (open ?? []).filter((x) => x.dueDate && x.dueDate < day).length;
  return (
    <ChecklistWidget
      loading={!open}
      empty={t.todos.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.todos, to: '/todos?new=1' }}
      summary={open && open.length > 0 ? t.widgets.todosSummary(open.length, overdue) : undefined}
      entries={(open ?? []).map((task) => {
        const s = task.dueDate ? dueState(task.dueDate, day) : undefined;
        return {
          key: task.id,
          title: task.title,
          checked: task.done,
          tone: s?.tone,
          label: s?.label,
        };
      })}
      onToggle={(id, done) => taskRepo.update(id, { done, completedAt: done ? now() : undefined })}
    />
  );
}
