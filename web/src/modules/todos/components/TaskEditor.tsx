import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { fromLegacy, refKey } from '@/core/entitylinks/types';
import { useResolvedLinks } from '@/core/modules/contributions';
import { getPlatform } from '@/core/platform';
import type { NotificationPermissionState } from '@/core/notifications/service';
import { useFocusSettings } from '@/core/settings/focus';
import { changedFields } from '@/core/db/patch';
import type { Stored } from '@/core/db/types';
import { RecurrenceEditor } from '@/core/recurrence/RecurrenceEditor';
import type { Recurrence } from '@/core/recurrence/types';
import {
  AdvancedFields,
  FormActions,
  Button,
  Chip,
  Chips,
  DateField,
  Dialog,
  Icon,
  IconButton,
  SelectField,
  Switch,
  TextArea,
  TextField,
  TimeField,
} from '@/ui';
import { t } from '@/strings';
import { now, today } from '@/core/time/now';
import { undoableWithToast } from '@/core/undo/withToast';
import { PersonField } from '@/core/people/PersonField';
import { beginFocus, focusPath } from '../focus';
import { deleteTask, taskRepo } from '../repo';
import { userPlannedFor } from '../views';
import type { ChecklistItem, Task, TaskLink, TodoList } from '../schema';
import { parseTags } from '../tags';
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
  const [opened, setOpened] = useState(task);
  const [title, setTitle] = useState(task.title);
  const [listId, setListId] = useState(task.listId);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [dueTime, setDueTime] = useState(task.dueTime ?? '');
  const [dueRemind, setDueRemind] = useState(task.dueRemind ?? false);
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getPlatform().notifications.permission(),
  );
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
  // Every link is read through its target module (`resolveLink`): alive, gone, or not readable on this device.
  const linkStates = useResolvedLinks(links.map((l) => fromLegacy(l).to));
  const [subTitle, setSubTitle] = useState('');
  const isSub = Boolean(task.parentId);
  const navigate = useNavigate();
  const [focus] = useFocusSettings();

  /**
   * „Entfernen“ on a link whose target no longer exists: written at once (the row says nothing true any more),
   * with the usual undo. The editor's baseline follows, so „Speichern“ does not write `links` a second time.
   */
  async function removeGone(l: TaskLink) {
    const without = (all: readonly TaskLink[] | undefined) =>
      (all ?? []).filter((x) => !(x.kind === l.kind && x.id === l.id));
    setLinks(without);
    setOpened((o) => ({ ...o, links: without(o.links).length ? without(o.links) : undefined }));
    await undoableWithToast(t.todos.links.removed, t.todos.links.removed, async () => {
      const current = await taskRepo.get(task.id);
      if (!current) return;
      const rest = without(current.links);
      await taskRepo.update(task.id, { links: rest.length ? rest : undefined });
    });
  }

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
        // The hour and its reminder only exist with a date; the reminder only with an hour.
        dueTime: (dueDate && dueTime) || undefined,
        dueRemind: (dueDate && dueTime && dueRemind) || undefined,
        recurrence: dueDate ? recurrence : undefined,
        someday: someday || undefined,
        estimateMin: estimate,
        // The planner's mark goes only when the date really changes (`userPlannedFor`).
        ...userPlannedFor(opened ?? task, plannedFor || undefined),
        note: note.trim() || undefined,
        personId: personId || undefined,
        startDate: startDate || undefined,
        tags: parseTags(tagsText).length ? parseTags(tagsText) : undefined,
        checklist: checklist.length ? checklist : undefined,
        links: links.length ? links : undefined,
      }),
    );
    // Subtasks always live in the list of their parent.
    if (listId !== (opened ?? task).listId) {
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
      {dueDate ? <TimeField label={t.todos.dueTime} value={dueTime} onChange={setDueTime} /> : null}
      {dueDate && dueTime ? (
        <Switch
          label={t.todos.dueRemind}
          hint={t.todos.dueRemindHint}
          checked={dueRemind}
          onChange={setDueRemind}
        />
      ) : null}
      {/* Switched on without the system's permission: one calm line, asked only on a tap (as the calendar's lead). */}
      {dueDate && dueTime && dueRemind && (permission === 'default' || permission === 'denied') ? (
        <div className={styles.dueHint} role="note" data-testid="due-permission-hint">
          <span>
            {permission === 'denied'
              ? t.todos.dueRemindPermissionDenied
              : t.todos.dueRemindPermissionMissing}
          </span>
          {permission === 'default' ? (
            <Button
              variant="ghost"
              onClick={async () =>
                setPermission(await getPlatform().notifications.requestPermission())
              }
            >
              {t.todos.dueRemindAllow}
            </Button>
          ) : null}
        </div>
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
            {links.map((l) => {
              const state = linkStates?.get(refKey(fromLegacy(l).to));
              // An alive target shows its title of today; everywhere else the label of the time stands in.
              const name = `${t.todos.links.kinds[l.kind]}: ${
                state?.state === 'alive' && state.title ? state.title : l.label
              }`;
              // Only a mail has a web address (its module is off, not on this device, or the thread is not cached).
              const url = state && 'url' in state ? state.url : undefined;
              return (
                <li key={`${l.kind}:${l.id}`} className={styles.checkItem}>
                  {state?.state === 'alive' ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onClose();
                        void navigate(state.to);
                      }}
                    >
                      {name}
                    </Button>
                  ) : (
                    <span className={styles.linkText}>
                      {name}
                      {state?.state === 'gone' ? ` · ${t.todos.links.gone}` : null}
                      {state?.state === 'elsewhere' ? ` · ${t.todos.links.elsewhere}` : null}
                    </span>
                  )}
                  {url ? (
                    <Button variant="ghost" onClick={() => void getPlatform().app.openUrl(url)}>
                      {t.todos.links.inBrowser}
                    </Button>
                  ) : null}
                  {state?.state === 'gone' ? (
                    <Button
                      aria-label={t.todos.links.remove(l.label)}
                      onClick={() => void removeGone(l)}
                    >
                      {t.todos.links.removeGone}
                    </Button>
                  ) : (
                    <IconButton
                      label={t.todos.links.remove(l.label)}
                      onClick={() => setLinks((all) => all.filter((x) => x !== l))}
                    >
                      <Icon name="trash" />
                    </IconButton>
                  )}
                </li>
              );
            })}
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

      {/* The focus round is a way out of the form, not part of its foot: the foot holds delete, cancel and save
          and stays at the lower edge of the sheet on the phone. */}
      {isSub || task.done ? null : (
        <div>
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
        </div>
      )}
      <FormActions
        start={
          <Button
            variant="danger"
            onClick={async () => {
              onClose();
              await deleteTaskUndoable(task.id);
            }}
          >
            {t.actions.delete}
          </Button>
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </form>
  );
}
