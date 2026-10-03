import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { today } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Dialog, SelectField } from '@/ui';
import { deleteTask, setDone, taskRepo } from '../repo';
import type { Task, TodoList } from '../schema';
import styles from './InboxSorter.module.css';

interface Props {
  open: boolean;
  /** Open, top-level tasks of the inbox that are not planned or parked yet, oldest first. */
  tasks: Stored<Task>[];
  lists: Stored<TodoList>[];
  onClose: () => void;
}

/**
 * Sorting the inbox one thing at a time: where does this go? Heute, Irgendwann, a list, done, away,
 * or skip. No decisions about anything else on screen; the dialog says when the inbox is empty.
 */
export function InboxSorter({ open, tasks, lists, onClose }: Props) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const remaining = tasks.filter((x) => !skipped.includes(x.id));
  const current = remaining[0];
  const total = tasks.length;
  const position = total - remaining.length + 1;
  const targets = lists.filter((l) => l.id !== current?.listId);

  return (
    <Dialog
      open={open}
      onClose={() => {
        setSkipped([]);
        onClose();
      }}
      title={t.todos.sort.title}
    >
      {current ? (
        <div className={styles.card} data-testid="inbox-sorter">
          <span className={styles.progress}>{t.todos.sort.progress(position, total)}</span>
          <span className={styles.title}>{current.title}</span>
          {current.note ? <span className={styles.note}>{current.note}</span> : null}
          <div className={styles.actions}>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => void taskRepo.update(current.id, { plannedFor: today() })}
            >
              {t.todos.sort.today}
            </Button>
            <Button onClick={() => void taskRepo.update(current.id, { someday: true })}>
              {t.todos.someday}
            </Button>
            <Button onClick={() => setSkipped([...skipped, current.id])}>
              {t.todos.sort.skip}
            </Button>
          </div>
          {targets.length > 0 ? (
            <SelectField
              label={t.todos.sort.toList}
              value=""
              onChange={(e) => {
                if (e.target.value) void taskRepo.update(current.id, { listId: e.target.value });
              }}
            >
              <option value="">{t.todos.sort.pickList}</option>
              {targets.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className={styles.quiet}>
            <Button
              variant="ghost"
              onClick={() =>
                void undoableWithToast(t.todos.markedDone, t.todos.markedDone, () =>
                  setDone(current, true),
                )
              }
            >
              {t.todos.sort.done}
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                void undoableWithToast(t.todos.taskDeleted, t.todos.taskDeleted, () =>
                  deleteTask(current.id),
                )
              }
            >
              {t.todos.sort.remove}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.card} data-testid="inbox-sorter-done">
          <span className={styles.title}>
            {total === 0 || skipped.length === 0
              ? t.todos.sort.empty
              : t.todos.sort.skippedLeft(skipped.length)}
          </span>
          <div className={styles.actions}>
            {skipped.length > 0 ? (
              <Button onClick={() => setSkipped([])}>{t.todos.sort.again}</Button>
            ) : null}
            <Button variant="primary" onClick={onClose}>
              {t.todos.sort.close}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
