import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useFocusSettings } from '@/core/settings/focus';
import { changedFields } from '@/core/db/patch';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import {
  AdvancedFields,
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
import { PersonField } from '@/core/people/PersonField';
import { beginFocus, focusPath } from '../focus';
import { deleteTask, taskRepo } from '../repo';
import type { ChecklistItem, Task, TaskLink, TodoList } from '../schema';
import { parseTags } from '../tags';
import styles from '../routes/todos.module.css';

/** Deleting a task (with its subtasks) is one action: the toast and Ctrl+Z bring it back. */
function deleteTaskUndoable(id: string) {
  return undoableWithToast(t.todos.taskDeleted, t.todos.taskDeleted, () => deleteTask(id));
}

/** Where a link of a task opens (`?open=<id>` is understood by every module page). */
export function linkPath(l: TaskLink): string {
  const base = { note: '/notes', mail: '/mail', invoice: '/invoices', event: '/calendar' }[l.kind];
  return `${base}?open=${encodeURIComponent(l.id)}`;
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
    <Dialog open={task !== null} onClose={onClose} title={t.todos.editTask} askAfterTyping>
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
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(task);
  const [title, setTitle] = useState(task.title);
  const [listId, setListId] = useState(task.listId);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(task.recurrence);
  const [someday, setSomeday] = useState(task.someday ?? false);
  const [estimate, setEstimate] = useState<number | undefined>(task.estimateMin);
  const [plannedFor, setPlannedFor] = useState(task.plannedFor ?? '');
  const [note, setNote] = useState(task.note ?? '');
  const [personId, setPersonId] = useState(task.personId ?? '');
  const [startDate, setStartDate] = useState(task.startDate ?? '');
  const [tagsText, setTagsText] = useState((task.tags ?? []).map((x) => `#${x}`).join(', '));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? []);
  const [itemText, setItemText] = useState('');
  const [links, setLinks] = useState<TaskLink[]>(task.links ?? []);
  const [subTitle, setSubTitle] = useState('');
  const isSub = Boolean(task.parentId);
  const navigate = useNavigate();
  const [focus] = useFocusSettings();

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    // Only what changed here: a field edited meanwhile elsewhere (another tab, sync) keeps its value.
    await taskRepo.update(
      task.id,
      changedFields(opened ?? task, {
        title: trimmed,
        listId,
        priority,
        dueDate: dueDate || undefined,
        recurrence: dueDate ? recurrence : undefined,
        someday: someday || undefined,
        estimateMin: estimate,
        plannedFor: plannedFor || undefined,
        note: note.trim() || undefined,
        personId: personId || undefined,
        startDate: startDate || undefined,
        tags: parseTags(tagsText).length ? parseTags(tagsText) : undefined,
        checklist: checklist.length ? checklist : undefined,
        links: links.length ? links : undefined,
      }),
    );
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

  function addItem(e: { preventDefault: () => void }) {
    e.preventDefault();
    const text = itemText.trim();
    if (!text) return;
    setChecklist((c) => [...c, { id: crypto.randomUUID(), text, done: false }]);
    setItemText('');
  }

  async function addSub(e: { preventDefault: () => void }) {
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
      {isSub ? null : <PersonField value={personId} onChange={setPersonId} />}
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
          <AdvancedFields
            moduleId="todos"
            hasData={someday || !!recurrence || !!startDate || tagsText.trim() !== ''}
          >
            <DateField
              label={t.todos.startDate}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              hint={t.todos.startHint}
            />
            <TextField
              label={t.todos.tags.label}
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              hint={t.todos.tags.hint}
            />
            {dueDate ? (
              <RecurrenceEditor value={recurrence} onChange={setRecurrence} startDate={dueDate} />
            ) : null}
            <Switch label={t.todos.somedayLabel} checked={someday} onChange={setSomeday} />
          </AdvancedFields>
        </>
      )}
      <TextArea label={t.form.note} value={note} onChange={(e) => setNote(e.target.value)} />

      {isSub ? null : (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {t.todos.checklist.title}
            {checklist.length > 0
              ? ` · ${t.todos.checklist.progress(checklist.filter((c) => c.done).length, checklist.length)}`
              : ''}
          </h3>
          <ul className={styles.checklist}>
            {checklist.map((c) => (
              <li key={c.id} className={styles.checkItem}>
                <input
                  type="checkbox"
                  className={styles.check}
                  aria-label={c.text}
                  checked={c.done}
                  onChange={(e) =>
                    setChecklist((all) =>
                      all.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)),
                    )
                  }
                />
                <span style={{ flex: 1 }}>{c.text}</span>
                <IconButton
                  label={t.todos.checklist.remove(c.text)}
                  onClick={() => setChecklist((all) => all.filter((x) => x.id !== c.id))}
                >
                  <Icon name="trash" />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className={styles.add} style={{ marginBottom: 0 }}>
            <div className={styles.grow}>
              <TextField
                label={t.todos.checklist.add}
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addItem(e);
                }}
              />
            </div>
            <Button onClick={addItem}>{t.actions.add}</Button>
          </div>
        </div>
      )}

      {links.length > 0 ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.todos.links.title}</h3>
          <ul className={styles.checklist}>
            {links.map((l) => (
              <li key={`${l.kind}:${l.id}`} className={styles.checkItem}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    onClose();
                    void navigate(linkPath(l));
                  }}
                >
                  {`${t.todos.links.kinds[l.kind]}: ${l.label}`}
                </Button>
                <IconButton
                  label={t.todos.links.remove(l.label)}
                  onClick={() => setLinks((all) => all.filter((x) => x !== l))}
                >
                  <Icon name="trash" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
            <Button onClick={(e) => void addSub(e)}>{t.actions.add}</Button>
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
          {isSub || task.done ? null : (
            <Button
              variant="ghost"
              onClick={async () => {
                await beginFocus(task, focus.focusMinutes);
                onClose();
                void navigate(focusPath(task.id));
              }}
            >
              {t.focus.mode.title}
            </Button>
          )}
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button type="submit" variant="primary">
            {t.actions.save}
          </Button>
        </span>
      </div>
    </form>
  );
}
