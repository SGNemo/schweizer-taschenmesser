import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { compareTasks, isActionable } from '../logic';
import { setDone, taskRepo } from '../repo';

export default function OpenTasksWidget() {
  const open = useLiveQuery(
    async () =>
      (await taskRepo.active().toArray())
        .filter((x) => !x.done && isActionable(x))
        .sort(compareTasks),
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
      onToggle={async (id, done) => {
        const task = await taskRepo.get(id);
        if (task) await setDone(task, done);
      }}
    />
  );
}
