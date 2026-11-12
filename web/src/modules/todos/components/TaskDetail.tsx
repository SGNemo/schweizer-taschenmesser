import type { Stored } from '@/core/db/types';
import { describeRecurrence } from '@/core/recurrence/describe';
import { formatDay, relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, DetailPanel } from '@/ui';
import type { Task } from '../schema';

/** Yesterday, today or tomorrow: only then the relative word ("Heute") says more than the date itself. */
const near = (date: string, day: string): boolean =>
  relativeDayLabel(date, day) !== formatDay(date, 'EEE, d. MMM');

/**
 * The task picked in the list, in the panel of the wide page (master–detail): its list, what it holds in words and
 * its note. Ticking, "Auf heute" and "Später" stay with the row; changing it is the dialog behind "Bearbeiten".
 */
export function TaskDetail({
  task,
  listName,
  person,
  subtasks,
  day,
  onEdit,
  onFocus,
  onClose,
}: {
  task: Stored<Task>;
  listName: string;
  /** Name of the person the task is for. */
  person?: string;
  subtasks: readonly Stored<Task>[];
  day: string;
  onEdit: () => void;
  /** Starts a focus round for the task (not offered for a done task or a subtask). */
  onFocus?: () => void;
  onClose: () => void;
}) {
  const checklist = task.checklist ?? [];
  const facts = [
    ...(task.dueDate
      ? [
          {
            label: t.todos.due,
            // The row carries the tone ("Überfällig", "Heute"); here the same fact is plain text, once.
            value: near(task.dueDate, day)
              ? `${formatDay(task.dueDate, 'EEEE, d. MMMM yyyy')} · ${relativeDayLabel(task.dueDate, day)}`
              : formatDay(task.dueDate, 'EEEE, d. MMMM yyyy'),
          },
        ]
      : []),
    ...(task.startDate && task.startDate > day
      ? [{ label: t.todos.detail.starts, value: formatDay(task.startDate, 'EEEE, d. MMMM yyyy') }]
      : []),
    ...(task.priority > 0 ? [{ label: t.todos.priority, value: t.todos.prio[task.priority] }] : []),
    ...(task.estimateMin
      ? [{ label: t.todos.estimate, value: t.todos.estimateMin(task.estimateMin) }]
      : []),
    ...(task.recurrence
      ? [{ label: t.recurrence.label, value: describeRecurrence(task.recurrence) }]
      : []),
    ...(person ? [{ label: t.assign.label, value: person }] : []),
    ...(task.tags?.length
      ? [{ label: t.todos.tags.label, value: task.tags.map((x) => `#${x}`).join(' ') }]
      : []),
    ...(subtasks.length
      ? [
          {
            label: t.todos.subtasks,
            value: t.todos.progress(subtasks.filter((x) => x.done).length, subtasks.length),
          },
        ]
      : []),
    ...(checklist.length
      ? [
          {
            label: t.todos.checklist.title,
            value: t.todos.checklist.progress(
              checklist.filter((c) => c.done).length,
              checklist.length,
            ),
          },
        ]
      : []),
    ...(task.note ? [{ label: t.form.note, value: task.note }] : []),
  ];
  return (
    <DetailPanel
      testId="task-detail"
      eyebrow={listName}
      title={task.title}
      facts={facts}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onEdit} data-row-edit>
            {t.actions.edit}
          </Button>
          {onFocus ? (
            <Button variant="ghost" onClick={onFocus}>
              {t.focus.mode.title}
            </Button>
          ) : null}
        </>
      }
    />
  );
}
