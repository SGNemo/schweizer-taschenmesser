import { useLiveQuery } from 'dexie-react-hooks';
import { useFocusSettings } from '@/core/settings/focus';
import { formatDay, today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { ChecklistWidget } from '@/ui';
import { compareTasks, isActionable } from '../logic';
import { setDone, taskRepo } from '../repo';

export default function OpenTasksWidget() {
  const [{ calmAttention: calm }] = useFocusSettings();
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
      summary={
        open && open.length > 0
          ? calm
            ? t.widgets.todosSummaryCalm(open.length, overdue)
            : t.widgets.todosSummary(open.length, overdue)
          : undefined
      }
      entries={(open ?? []).map((task) => {
        const s = task.dueDate ? dueState(task.dueDate, day) : undefined;
        // Calm: an old date is shown as a plain date, not as a red "seit 12 Tagen".
        const waiting = calm && s?.tone === 'overdue' && task.dueDate;
        return {
          key: task.id,
          title: task.title,
          checked: task.done,
          tone: waiting ? ('later' as const) : s?.tone,
          label: waiting ? formatDay(task.dueDate!, 'EEE, d. MMM') : s?.label,
        };
      })}
      onToggle={async (id, done) => {
        const task = await taskRepo.get(id);
        if (task) await setDone(task, done);
      }}
    />
  );
}
