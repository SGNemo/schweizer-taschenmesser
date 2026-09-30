import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { useSettings } from '@/core/settings/settings';
import { relativeDayLabel, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button, EmptyState, Icon, IconButton, TextField } from '@/ui';
import { ListEditor } from '../components/ListEditor';
import { TaskEditor } from '../components/TaskEditor';
import { dueTone, groupTasks } from '../logic';
import { ensureInbox, listRepo, taskRepo } from '../repo';
import type { Task, TodoList } from '../schema';
import { settings } from '../settings';
import styles from './todos.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

type StoredTask = Stored<Task>;

const ALL = 'all';

interface RowProps {
  task: StoredTask;
  subs: StoredTask[];
  allSubs: StoredTask[];
  day: string;
  /** Name of the task's list, shown in the "all" view. */
  showList?: string;
  sub?: boolean;
  onToggle: (task: StoredTask, done: boolean) => void;
  onOpen: (task: StoredTask) => void;
}

function TaskRow({ task, subs, allSubs, day, showList, sub, onToggle, onOpen }: RowProps) {
  const tone = dueTone(task.dueDate, task.done, day);
  return (
    <li>
      <div className={`${styles.row} ${sub ? styles.sub : ''} ${task.done ? styles.done : ''}`}>
        <input
          type="checkbox"
          className={styles.check}
          aria-label={task.title}
          checked={task.done}
          onChange={(e) => onToggle(task, e.target.checked)}
        />
        <button type="button" className={styles.open} onClick={() => onOpen(task)}>
          <span className={styles.title}>{task.title}</span>
          <span className={styles.meta}>
            {showList ? <span>{showList}</span> : null}
            {task.priority >= 2 ? (
              <span className={task.priority === 3 ? styles.prio3 : styles.prio2}>
                ● {t.todos.prio[task.priority]}
              </span>
            ) : null}
            {task.dueDate ? (
              <span
                className={
                  tone === 'overdue' ? styles.overdue : tone === 'today' ? styles.today : ''
                }
              >
                {tone === 'overdue' ? `${t.todos.overdue}: ` : ''}
                {relativeDayLabel(task.dueDate, day)}
              </span>
            ) : null}
            {allSubs.length > 0 ? (
              <span>{t.todos.progress(allSubs.filter((x) => x.done).length, allSubs.length)}</span>
            ) : null}
          </span>
        </button>
      </div>
      {subs.length > 0 ? (
        <ul className={styles.list} style={{ marginTop: 'var(--space-2)' }}>
          {subs.map((s) => (
            <TaskRow
              key={s.id}
              task={s}
              subs={[]}
              allSubs={[]}
              day={day}
              sub
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function toggle(task: StoredTask, done: boolean) {
  void taskRepo.update(task.id, { done, completedAt: done ? now() : undefined });
}

export default function TodosPage() {
  const lists = useLiveQuery(() => listRepo.active().sortBy('order'), []);
  const tasks = useLiveQuery(() => taskRepo.active().toArray(), []);
  const [prefs] = useSettings('module.todos', settings.schema, settings.defaults);
  const [params, setParams] = useSearchParams();
  // A shared title (`/todos?new=1&title=…`, from the share page) prefills the create field.
  const [title, setTitle] = useState(() => params.get('title') ?? '');
  const [editing, setEditing] = useState<StoredTask | null>(null);
  const [listTarget, setListTarget] = useState<Stored<TodoList> | 'new' | null>(null);
  const addRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (lists && lists.length === 0) void ensureInbox(t.todos.inbox);
  }, [lists]);

  // `?new=1` (Quick-Add) focuses the create field.
  useEffect(() => {
    if (params.get('new')) {
      addRef.current?.querySelector('input')?.focus();
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('title');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const selected = params.get('list') ?? ALL;
  const currentList = lists?.find((l) => l.id === selected);
  const targetListId = currentList?.id ?? lists?.[0]?.id;
  const showDone =
    ((prefs as { showDone?: boolean } | undefined)?.showDone ?? true) && selected !== ALL;

  const visible = useMemo(() => {
    const scoped = (tasks ?? []).filter((x) => selected === ALL || x.listId === selected);
    return scoped.filter((x) => showDone || !x.done);
  }, [tasks, selected, showDone]);
  const { top, children } = useMemo(() => groupTasks(visible), [visible]);
  const listName = (id: string) => lists?.find((l) => l.id === id)?.name ?? '';
  const editingSubs = editing
    ? ((tasks ?? []).filter((x) => x.parentId === editing.id) as StoredTask[])
    : [];
  const editingLive = editing ? ((tasks ?? []).find((x) => x.id === editing.id) ?? null) : null;

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value || !targetListId) return;
    await taskRepo.create({
      listId: targetListId,
      title: value,
      done: false,
      priority: 0,
      order: 0,
    });
    setTitle('');
  }

  function select(id: string) {
    const next = new URLSearchParams(params);
    if (id === ALL) next.delete('list');
    else next.set('list', id);
    setParams(next, { replace: true });
  }

  const day = today();

  return (
    <>
      <div className={styles.header}>
        <h1>{t.todos.title}</h1>
        <Button onClick={() => setListTarget('new')}>
          <Icon name="plus" size={18} />
          {t.todos.newList}
        </Button>
      </div>

      <div className={styles.layout}>
        <nav className={styles.chips} aria-label={t.todos.list}>
          <button
            type="button"
            className={styles.chip}
            aria-current={selected === ALL}
            onClick={() => select(ALL)}
          >
            {t.todos.allOpen}
          </button>
          {lists?.map((l) => (
            <button
              key={l.id}
              type="button"
              className={styles.chip}
              aria-current={selected === l.id}
              onClick={() => select(l.id)}
            >
              {l.name}
            </button>
          ))}
          {currentList ? (
            <IconButton label={t.todos.renameList} onClick={() => setListTarget(currentList)}>
              <Icon name="edit" />
            </IconButton>
          ) : null}
        </nav>

        <div className={styles.main}>
          <form ref={addRef} onSubmit={add} className={styles.add}>
            <div className={styles.grow}>
              <TextField
                label={t.todos.add}
                placeholder={t.todos.addPlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" disabled={!targetListId}>
              {t.actions.add}
            </Button>
          </form>

          {tasks && top.length === 0 ? (
            <EmptyState icon="checklist" title={t.todos.empty}>
              <StartDataButton moduleId="todos" />
            </EmptyState>
          ) : null}
          <ul className={styles.list}>
            {top.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                subs={children.get(task.id) ?? []}
                allSubs={(tasks ?? []).filter((x) => x.parentId === task.id)}
                day={day}
                showList={selected === ALL ? listName(task.listId) : undefined}
                onToggle={toggle}
                onOpen={setEditing}
              />
            ))}
          </ul>
        </div>
      </div>

      <TaskEditor
        task={editingLive}
        subtasks={editingSubs}
        lists={(lists ?? []) as Stored<TodoList>[]}
        onClose={() => setEditing(null)}
      />
      <ListEditor
        target={listTarget}
        nextOrder={(lists?.length ?? 0) + 1}
        onClose={(createdId) => {
          setListTarget(null);
          if (createdId) select(createdId);
          else if (
            listTarget !== 'new' &&
            listTarget &&
            !lists?.some((l) => l.id === listTarget.id)
          )
            select(ALL);
        }}
      />
    </>
  );
}
