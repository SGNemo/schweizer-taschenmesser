import { useState, type FormEvent } from 'react';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import {
  Button,
  Chip,
  Chips,
  DateField,
  Dialog,
  Icon,
  IconButton,
  patternStyles,
  SelectField,
  Switch,
  TextArea,
  TextField,
} from '@/ui';
import { t } from '@/strings';
import { now, today } from '@/core/time/now';
import { undoableWithToast } from '@/core/undo/withToast';
import { deleteTask, taskRepo } from '../repo';
import type { Task, TodoList } from '../schema';
import styles from '../routes/todos.module.css';

/** Deleting a task (with its subtasks) is one action: the toast and Ctrl+Z bring it back. */
function deleteTaskUndoable(id: string) {
  return undoableWithToast(t.todos.taskDeleted, t.todos.taskDeleted, () => deleteTask(id));
}

/** Offered effort estimates in minutes. */
const ESTIMATES = [5, 15, 30, 60] as const;

type StoredTask = Stored<Task>;
type StoredList = Stored<TodoList>;

interface Props {
  task: StoredTask | null;
  subtasks: StoredTask[];
  lists: StoredList[];
  onClose: () => void;
}

export function TaskEditor({ task, subtasks, lists, onClose }: Props) {
  return (
    <Dialog open={task !== null} onClose={onClose} title={t.todos.editTask}>
      {task ? (
        <EditorForm key={task.id} task={task} subtasks={subtasks} lists={lists} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function EditorForm({
  task,
  subtasks,
  lists,
  onClose,
}: Omit<Props, 'task'> & { task: StoredTask }) {
  const [title, setTitle] = useState(task.title);
  const [listId, setListId] = useState(task.listId);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(task.recurrence);
  const [someday, setSomeday] = useState(task.someday ?? false);
  const [estimate, setEstimate] = useState<number | undefined>(task.estimateMin);
  const [plannedFor, setPlannedFor] = useState(task.plannedFor ?? '');
  const [note, setNote] = useState(task.note ?? '');
  const [subTitle, setSubTitle] = useState('');
  const isSub = Boolean(task.parentId);

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await taskRepo.update(task.id, {
      title: trimmed,
      listId,
      priority,
      dueDate: dueDate || undefined,
      recurrence: dueDate ? recurrence : undefined,
      someday: someday || undefined,
      estimateMin: estimate,
      plannedFor: plannedFor || undefined,
      note: note.trim() || undefined,
    });
    // Subtasks always live in the list of their parent.
    if (listId !== task.listId) {
      await taskRepo.table
        .where('parentId')
        .equals(task.id)
        .filter((s) => s.deletedAt === null)
        .each((s) => void taskRepo.update(s.id, { listId }));
    }
    onClose();
  }

  async function addSub(e: FormEvent) {
    e.preventDefault();
    const value = subTitle.trim();
    if (!value) return;
    await taskRepo.create({
      listId: task.listId,
      parentId: task.id,
      title: value,
      done: false,
      priority: 0,
      order: 0,
    });
    setSubTitle('');
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <TextField
        label={t.form.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        data-autofocus
      />
      {isSub ? null : (
        <SelectField
          label={t.todos.list}
          value={listId}
          onChange={(e) => setListId(e.target.value)}
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField
        label={t.todos.priority}
        value={String(priority)}
        onChange={(e) => setPriority(Number(e.target.value))}
      >
        {t.todos.prio.map((label, i) => (
          <option key={label} value={i}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t.todos.due}
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      {dueDate && !isSub ? (
        <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={dueDate} />
      ) : null}
      {isSub ? null : (
        <>
          <Chips label={t.todos.estimate}>
            <Chip
              label={t.todos.estimateNone}
              selected={estimate === undefined}
              onClick={() => setEstimate(undefined)}
            />
            {ESTIMATES.map((n) => (
              <Chip
                key={n}
                label={t.todos.estimateMin(n)}
                selected={estimate === n}
                onClick={() => setEstimate(n)}
              />
            ))}
          </Chips>
          <DateField
            label={t.todos.planned}
            value={plannedFor}
            onChange={(e) => setPlannedFor(e.target.value)}
          />
          <Chips label={t.todos.planned}>
            <Chip label={t.todos.planToday} onClick={() => setPlannedFor(today())} />
            {plannedFor ? (
              <Chip label={t.todos.planClear} onClick={() => setPlannedFor('')} />
            ) : null}
          </Chips>
        </>
      )}
      {isSub ? null : (
        <Switch label={t.todos.somedayLabel} checked={someday} onChange={setSomeday} />
      )}
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />

      {isSub ? null : (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.todos.subtasks}</h3>
          <ul className={styles.subs}>
            {subtasks.map((s) => (
              <li key={s.id} className={styles.subRow}>
                <input
                  type="checkbox"
                  className={styles.check}
                  aria-label={s.title}
                  checked={s.done}
                  onChange={(e) =>
                    void taskRepo.update(s.id, {
                      done: e.target.checked,
                      completedAt: e.target.checked ? now() : undefined,
                    })
                  }
                />
                <span className={styles.grow} style={{ flex: 1 }}>
                  {s.title}
                </span>
                <IconButton label={t.actions.delete} onClick={() => void deleteTaskUndoable(s.id)}>
                  <Icon name="trash" />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className={styles.add} style={{ marginBottom: 0 }}>
            <div className={styles.grow}>
              <TextField
                label={t.todos.addSubtask}
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addSub(e);
                }}
              />
            </div>
            <Button onClick={(e) => void addSub(e as unknown as FormEvent)}>{t.actions.add}</Button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="danger"
          onClick={async () => {
            onClose();
            await deleteTaskUndoable(task.id);
          }}
        >
          {t.actions.delete}
        </Button>
        <span className={patternStyles.hstack}>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
