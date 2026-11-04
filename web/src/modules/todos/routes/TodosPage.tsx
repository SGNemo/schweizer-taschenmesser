import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { copyData } from '@/core/db/copy';
import type { Stored } from '@/core/db/types';
import { undoable } from '@/core/undo';
import { skipSuggestion } from '@/core/focus/state';
import { usePageChrome } from '@/core/shell/pageChrome';
import { useWriteAvailable, useWriteLabel } from '@/core/shell/writeAvailable';
import { useAdvanced } from '@/core/settings/comfort';
import { useFocusSettings } from '@/core/settings/focus';
import { useSettings } from '@/core/settings/settings';
import { formatDay, relativeDayLabel, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { groupByTime } from '@/core/time/groups';
import { DATE_PRESETS, presetDate } from '@/core/time/quickShift';
import { changeWithUndo, deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { tAdvanced } from '@/strings.advanced';
import { useUiStore } from '@/stores/ui';
import {
  Button,
  EmptyState,
  GroupedList,
  ItemList,
  ItemRow,
  PageHeader,
  Progress,
  RowMenu,
  TextField,
  type RowMenuItem,
  useOpenParam,
} from '@/ui';
import { HeroSlot } from '@/ui/identity';
import { BoardView } from '../components/BoardView';
import { InboxSorter } from '../components/InboxSorter';
import { TodayCard } from '../components/TodayCard';
import { ListEditor } from '../components/ListEditor';
import { TaskEditor } from '../components/TaskEditor';
import { describeRecurrence } from '@/core/recurrence/describe';
import { dueTone, groupTasks, isActionable } from '../logic';
import { replan, type PickTask } from '../next';
import { beginFocus, focusPath } from '../focus';
import { postponePatch } from '../postpone';
import { seriesKey, streaksOf, type Streak } from '../progress';
import { PersonFilter, usePersonFilter } from '@/core/people/PersonFilter';
import { personName, usePeople } from '@/core/people/people';
import { readQuickAdd } from '../quickAdd';
import { tagCounts } from '../tags';
import { movePatch, overdueTasks, TODO_VIEWS, viewOf, type TodoView } from '../views';
import { deleteTask, ensureInbox, INBOX_ID, listRepo, setDone, taskRepo } from '../repo';
import type { Task, TodoList } from '../schema';
import { settings } from '../settings';
import styles from './todos.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

type StoredTask = Stored<Task>;

const ALL = 'all';
const SOMEDAY = 'someday';

/** The page shows the grouped list (default), one of the four views, or the board. */
type PageView = 'list' | TodoView | 'board';
const PAGE_VIEWS: PageView[] = ['list', ...TODO_VIEWS, 'board'];

interface RowProps {
  task: StoredTask;
  subs: StoredTask[];
  allSubs: StoredTask[];
  day: string;
  /** Name of the task's list, shown in the "all" view. */
  showList?: string;
  /** Name of the person the task is for. */
  person?: string;
  sub?: boolean;
  /** Calm wording: an old date is a plain date, not "Überfällig" in red. */
  calm?: boolean;
  /** A visible "Morgen" button (the Heute view). */
  quickTomorrow?: boolean;
  /** "n in Folge" of the task's series (shown on the open instance only). */
  streaks?: Map<string, Streak>;
  onToggle: (task: StoredTask, done: boolean) => void;
  onOpen: (task: StoredTask) => void;
}

function TaskRow({
  task,
  subs,
  allSubs,
  day,
  showList,
  person,
  sub,
  calm,
  quickTomorrow,
  streaks,
  onToggle,
  onOpen,
}: RowProps) {
  // A short check-mark pop after a tick (≤ 250 ms; the global motion rules switch it off when reduced).
  const [popped, setPopped] = useState(false);
  const tone = dueTone(task.dueDate, task.done, day);
  const waiting = calm && tone === 'overdue';
  const streak = !task.done && task.recurrence ? streaks?.get(seriesKey(task.id)) : undefined;
  const laterItem: RowMenuItem = {
    id: 'later',
    label: t.focus.next.later,
    onSelect: () => postpone(task, day),
  };
  const dueMenu: RowMenuItem[] = DATE_PRESETS.map((p) => ({
    id: `due-${p}`,
    group: t.todos.due,
    label: t.ui.datePresets[p],
    onSelect: () => moveDue(task, presetDate(p, day)),
  }));
  if (task.dueDate)
    dueMenu.push({
      id: 'due-none',
      group: t.todos.due,
      label: t.todos.noDue,
      onSelect: () => moveDue(task, undefined),
    });
  const prioMenu: RowMenuItem[] = ([3, 0] as const)
    .filter((p) => p !== task.priority)
    .map((p) => ({
      id: `prio-${p}`,
      group: t.todos.priority,
      label: t.todos.prio[p],
      onSelect: () =>
        void changeWithUndo(() => taskRepo.update(task.id, { priority: p }), t.todos.changed),
    }));
  return (
    <ItemRow
      title={task.title}
      done={task.done}
      tone={tone === 'overdue' && !waiting ? 'overdue' : tone === 'today' ? 'today' : undefined}
      className={sub ? styles.sub : undefined}
      onOpen={() => onOpen(task)}
      onSwipeRight={() => onToggle(task, !task.done)}
      swipeRightLabel={task.done ? t.todos.markedOpen : t.todos.markedDone}
      onSwipeLeft={task.done ? undefined : () => postpone(task, day)}
      swipeLeftLabel={t.focus.next.later}
      menu={[
        ...(task.done ? [] : [laterItem, ...dueMenu]),
        ...(task.done ? [] : prioMenu),
        {
          id: 'duplicate',
          label: t.actions.duplicate,
          onSelect: () =>
            void undoableWithToast(t.actions.duplicated, t.actions.duplicated, () =>
              taskRepo.create({ ...copyData(task), done: false, completedAt: undefined }),
            ),
        },
        {
          id: 'delete',
          label: t.actions.delete,
          danger: true,
          onSelect: () => void deleteWithUndo(() => deleteTask(task.id), t.todos.taskDeleted),
        },
      ]}
      end={
        waiting ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveDue(task, presetDate('today', day))}
            data-testid="move-today"
          >
            {t.todos.moveToday}
          </Button>
        ) : quickTomorrow && !task.done ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => postpone(task, day)}
            data-testid="move-tomorrow"
          >
            {t.todos.moveTomorrow}
          </Button>
        ) : undefined
      }
      lead={
        <input
          type="checkbox"
          className={`${styles.check} ${popped ? styles.tickPop : ''}`}
          aria-label={task.title}
          data-row-tick
          checked={task.done}
          onChange={(e) => {
            if (e.target.checked) {
              setPopped(true);
              setTimeout(() => setPopped(false), 250);
            }
            onToggle(task, e.target.checked);
          }}
        />
      }
      meta={
        <span className={styles.meta}>
          {showList ? <span>{showList}</span> : null}
          {person ? <span>{t.assign.forName(person)}</span> : null}
          {task.priority >= 2 ? (
            <span className={task.priority === 3 ? styles.prio3 : styles.prio2}>
              {task.priority === 3 ? <span aria-hidden="true">▲</span> : null}{' '}
              {t.todos.prio[task.priority]}
            </span>
          ) : null}
          {task.dueDate ? (
            <span
              className={
                waiting
                  ? styles.waitingDate
                  : tone === 'overdue'
                    ? styles.overdue
                    : tone === 'today'
                      ? styles.today
                      : ''
              }
            >
              {tone === 'overdue' && !waiting ? `${t.todos.overdue}: ` : ''}
              {waiting
                ? formatDay(task.dueDate, 'EEE, d. MMM')
                : relativeDayLabel(task.dueDate, day)}
            </span>
          ) : null}
          {task.startDate && task.startDate > day ? (
            <span>{t.todos.startsOn(formatDay(task.startDate, 'EEE, d. MMM'))}</span>
          ) : null}
          {task.recurrence ? <span>↻ {describeRecurrence(task.recurrence)}</span> : null}
          {task.tags?.length ? <span>{task.tags.map((x) => `#${x}`).join(' ')}</span> : null}
          {task.checklist?.length ? (
            <span>
              {t.todos.checklist.progress(
                task.checklist.filter((c) => c.done).length,
                task.checklist.length,
              )}
            </span>
          ) : null}
          {streak ? (
            <span data-testid="streak">
              {streak.rest > 0
                ? t.focus.progress.streakRest(streak.streak)
                : t.focus.progress.streak(streak.streak)}
            </span>
          ) : null}
          {allSubs.length > 0 ? (
            <span className={styles.subProgress}>
              <span className={styles.subTrack}>
                <Progress
                  value={allSubs.filter((x) => x.done).length}
                  max={allSubs.length}
                  label={task.title}
                />
              </span>
              {t.todos.progress(allSubs.filter((x) => x.done).length, allSubs.length)}
            </span>
          ) : null}
        </span>
      }
    >
      {subs.length > 0 ? (
        <ItemList>
          {subs.map((s) => (
            <TaskRow
              key={s.id}
              task={s}
              subs={[]}
              allSubs={[]}
              day={day}
              sub
              calm={calm}
              quickTomorrow={quickTomorrow}
              streaks={streaks}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
        </ItemList>
      ) : null}
    </ItemRow>
  );
}

/** Moves the due date ("Morgen", "Nächste Woche", none) as one undoable change. */
function moveDue(task: StoredTask, dueDate: string | undefined) {
  void changeWithUndo(() => taskRepo.update(task.id, { dueDate }), t.todos.changed);
}

/** "Später": out of today in one step, with the same toast and undo as the card. */
function postpone(task: StoredTask, day: string) {
  void undoableWithToast(t.focus.next.laterDone, t.focus.next.laterDone, () =>
    taskRepo.update(task.id, postponePatch(task, day)),
  ).then(() => skipSuggestion(task.id, day));
}

function toggle(task: StoredTask, done: boolean) {
  const message = done ? t.todos.markedDone : t.todos.markedOpen;
  void undoableWithToast(message, message, () => setDone(task, done));
}

export default function TodosPage() {
  const lists = useLiveQuery(() => listRepo.active().sortBy('order'), []);
  const tasks = useLiveQuery(() => taskRepo.active().toArray(), []);
  const [prefs] = useSettings('module.todos', settings.schema, settings.defaults);
  const [focus] = useFocusSettings();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  // A shared title (`/todos?new=1&title=…`, from the share page) prefills the create field.
  const [title, setTitle] = useState(() => params.get('title') ?? '');
  const [editing, setEditing] = useState<StoredTask | null>(null);
  useOpenParam((id) => taskRepo.get(id), setEditing);
  const [listTarget, setListTarget] = useState<Stored<TodoList> | 'new' | null>(null);
  const [sorting, setSorting] = useState(false);
  const addRef = useRef<HTMLFormElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [advanced, setAdvanced] = useAdvanced('todos');
  const tx = tAdvanced.use();
  const writeAvailable = useWriteAvailable('todos');
  const writeLabel = useWriteLabel();
  const openWrite = useUiStore((s) => s.openWritePalette);
  const toast = useUiStore((s) => s.toast);
  // The page has its own add field: no round "+" button, and the AI entry lives in the "⋯" menu.
  usePageChrome({ hideFab: true, writeInMenu: true });

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

  const day = today();
  const rawView = params.get('view');
  const pageView: PageView = PAGE_VIEWS.includes(rawView as PageView)
    ? (rawView as PageView)
    : 'list';
  const tag = params.get('tag') ?? '';
  const selected = params.get('list') ?? ALL;
  const currentList = lists?.find((l) => l.id === selected);
  // Without a chosen list a new ToDo lands in the inbox (sorted later), not in whichever list is first.
  const targetListId =
    currentList?.id ?? lists?.find((l) => l.id === INBOX_ID)?.id ?? lists?.[0]?.id;
  const showDone =
    ((prefs as { showDone?: boolean } | undefined)?.showDone ?? true) &&
    selected !== ALL &&
    selected !== SOMEDAY;

  const forPerson = usePersonFilter();
  const people = usePeople();
  const visible = useMemo(() => {
    const all = tasks ?? [];
    const matches = (x: StoredTask) =>
      (!forPerson || x.personId === forPerson) && (!tag || !!x.tags?.includes(tag));
    if (pageView === 'list') {
      const scoped =
        selected === SOMEDAY
          ? all.filter((x) => x.someday)
          : all.filter(
              (x) =>
                isActionable(x) &&
                // Not started yet = under "Demnächst", not in the plain list.
                !(x.startDate && x.startDate > day && !x.parentId) &&
                (selected === ALL || x.listId === selected),
            );
      return scoped.filter((x) => (showDone || !x.done) && matches(x));
    }
    // A view picks top-level tasks by their dates; their subtasks and checklist ride along.
    const inList = (x: StoredTask) =>
      selected === ALL || selected === SOMEDAY || x.listId === selected;
    const tops = all.filter(
      (x) =>
        !x.parentId &&
        inList(x) &&
        matches(x) &&
        (pageView === 'board' || viewOf(x, day) === pageView),
    );
    if (pageView === 'board') return tops;
    const ids = new Set(tops.map((x) => x.id));
    return [...tops, ...all.filter((x) => x.parentId && ids.has(x.parentId))];
  }, [tasks, selected, showDone, forPerson, tag, pageView, day]);
  const { top, children } = useMemo(() => groupTasks(visible), [visible]);
  const tagList = useMemo(() => tagCounts(tasks ?? []), [tasks]);
  const project = useMemo(() => {
    if (currentList?.kind !== 'project') return null;
    const own = (tasks ?? []).filter((x) => x.listId === currentList.id && !x.parentId);
    return { done: own.filter((x) => x.done).length, total: own.length };
  }, [tasks, currentList]);
  const listName = (id: string) => lists?.find((l) => l.id === id)?.name ?? '';
  const editingSubs = editing
    ? ((tasks ?? []).filter((x) => x.parentId === editing.id) as StoredTask[])
    : [];
  const editingLive = editing ? ((tasks ?? []).find((x) => x.id === editing.id) ?? null) : null;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !targetListId) return;
    const typed = readQuickAdd(title, new Date(now()));
    // One line of feedback; Ctrl+Z still takes it back (no second "Rückgängig" next to the next action's).
    await undoable(t.todos.added, () =>
      taskRepo.create({
        listId: targetListId,
        title: typed.title,
        done: false,
        priority: typed.priority ?? 0,
        order: 0,
        ...(typed.dueDate ? { dueDate: typed.dueDate } : {}),
        ...(typed.estimateMin ? { estimateMin: typed.estimateMin } : {}),
        ...(typed.note ? { note: typed.note } : {}),
        ...((selected === SOMEDAY || pageView === 'someday') && !typed.dueDate
          ? { someday: true }
          : {}),
        ...(pageView === 'today' && !typed.dueDate ? { plannedFor: day } : {}),
      }),
    );
    toast(t.todos.added);
    setTitle('');
    // The next entry follows right away: the field keeps the focus (and the keyboard stays up).
    addRef.current?.querySelector('input')?.focus();
  }

  function setParam(key: 'view' | 'tag', value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function select(id: string) {
    const next = new URLSearchParams(params);
    if (id === ALL) next.delete('list');
    else next.set('list', id);
    setParams(next, { replace: true });
  }

  const streaks = useMemo(
    () => (focus.streaks && tasks ? streaksOf(tasks, day) : undefined),
    [focus.streaks, tasks, day],
  );
  const groups = useMemo(() => {
    const open = top.filter((x) => !x.done);
    const row = (task: StoredTask) => (
      <TaskRow
        key={task.id}
        task={task}
        subs={children.get(task.id) ?? []}
        allSubs={(tasks ?? []).filter((x) => x.parentId === task.id)}
        day={day}
        showList={selected === ALL || selected === SOMEDAY ? listName(task.listId) : undefined}
        person={personName(people, task.personId)}
        calm={focus.calmAttention}
        quickTomorrow={pageView === 'today'}
        streaks={streaks}
        onToggle={toggle}
        onOpen={setEditing}
      />
    );
    const timed = groupByTime(open, (x) => x.dueDate, day).map((g) => ({
      id: g.id,
      label:
        g.id === 'overdue' && focus.calmAttention
          ? t.groups.waiting
          : (t.groups[g.id as keyof typeof t.groups] as string),
      count: g.items.length,
      tone: g.id === 'overdue' && !focus.calmAttention ? ('overdue' as const) : undefined,
      action:
        g.id === 'overdue' && focus.calmAttention ? (
          <div className={styles.waiting} data-testid="todos-waiting">
            <span className={styles.waitingText}>
              <span>{t.focus.waiting.replanHint}</span>
            </span>
            <Button onClick={replanNow}>{t.focus.waiting.replan}</Button>
          </div>
        ) : g.id === 'overdue' ? (
          <div className={styles.waiting}>
            <Button onClick={moveOverdueToday} data-testid="all-today">
              {t.todos.allToday}
            </Button>
          </div>
        ) : undefined,
      children: <ItemList>{g.items.map(row)}</ItemList>,
    }));
    const done = top.filter((x) => x.done);
    return done.length > 0
      ? [
          ...timed,
          {
            id: 'done',
            label: t.groups.done,
            count: done.length,
            tone: undefined,
            children: <ItemList>{done.map(row)}</ItemList>,
          },
        ]
      : timed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, children, tasks, day, selected, focus.calmAttention, lists, pageView]);
  const inboxOpen = useMemo(
    () =>
      ((tasks ?? []) as StoredTask[])
        .filter(
          (x) => x.listId === INBOX_ID && !x.done && !x.someday && !x.parentId && !x.plannedFor,
        )
        .sort((a, b) => a.createdAt - b.createdAt),
    [tasks],
  );

  function moveOverdueToday() {
    const list = overdueTasks((tasks ?? []) as StoredTask[], day);
    void undoableWithToast(
      t.todos.allTodayDone(list.length),
      t.todos.allTodayDone(list.length),
      async () => {
        for (const x of list) await taskRepo.update(x.id, { dueDate: day });
      },
    );
  }

  /** Board / menu move into a column; "Erledigt" ticks off (a repeat creates its next instance). */
  function moveTo(task: StoredTask, to: TodoView) {
    void undoableWithToast(t.todos.changed, t.todos.changed, async () => {
      if (to === 'done') {
        await setDone(task, true);
        return;
      }
      if (task.done) await setDone(task, false);
      await taskRepo.update(task.id, movePatch(task, to, day));
    });
  }

  async function startFocus(id: string) {
    const task = tasks?.find((x) => x.id === id);
    if (!task) return;
    // A round that runs for another task is not replaced here: the focus screen asks first.
    await beginFocus(task, focus.focusMinutes);
    void navigate(focusPath(id));
  }

  function replanNow() {
    const moves = replan((tasks ?? []) as unknown as PickTask[], day, focus.planLimit);
    void undoableWithToast(t.focus.waiting.replanned, t.focus.waiting.replanned, async () => {
      for (const m of moves) await taskRepo.update(m.id, { dueDate: m.dueDate });
    });
  }

  const pageMenu: RowMenuItem[] = [
    {
      id: 'list-all',
      group: t.todos.listGroup,
      label: t.todos.allOpen,
      checked: selected === ALL,
      onSelect: () => select(ALL),
    },
    {
      id: 'list-someday',
      group: t.todos.listGroup,
      label: t.todos.someday,
      checked: selected === SOMEDAY,
      onSelect: () => select(SOMEDAY),
    },
    ...(lists ?? []).map((l) => ({
      id: `list-${l.id}`,
      group: t.todos.listGroup,
      label: l.name,
      checked: selected === l.id,
      onSelect: () => select(l.id),
    })),
    {
      id: 'new-list',
      group: t.todos.moreOptions,
      label: t.todos.newList,
      onSelect: () => setListTarget('new'),
    },
    ...(currentList
      ? [
          {
            id: 'rename-list',
            group: t.todos.moreOptions,
            label: t.todos.renameList,
            onSelect: () => setListTarget(currentList),
          },
        ]
      : []),
    {
      id: 'advanced',
      group: t.todos.moreOptions,
      label: tx.switchLabel,
      checked: advanced,
      onSelect: () => setAdvanced(!advanced),
    },
    ...(writeAvailable
      ? [
          {
            id: 'write',
            group: t.todos.moreOptions,
            label: writeLabel.label,
            onSelect: openWrite,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title={t.todos.title}
        views={
          <div className={styles.viewBar} role="group" aria-label={t.todos.views.label}>
            {PAGE_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                className={styles.tagChip}
                aria-pressed={pageView === v}
                onClick={() => setParam('view', v === 'list' ? null : v)}
              >
                {v === 'list' ? t.todos.views.all : t.todos.views[v]}
              </button>
            ))}
          </div>
        }
      >
        <RowMenu
          label={t.todos.moreOptions}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={pageMenu}
        />
      </PageHeader>

      {selected !== ALL ? (
        <p className={styles.filterNote} data-testid="todos-filter">
          {t.todos.showingList(
            selected === SOMEDAY ? t.todos.someday : (currentList?.name ?? t.todos.allOpen),
          )}{' '}
          <button type="button" className={styles.filterReset} onClick={() => select(ALL)}>
            {t.todos.allOpen}
          </button>
        </p>
      ) : null}

      {tasks ? (
        <HeroSlot>
          <TodayCard
            tasks={tasks}
            day={day}
            focusMinutes={focus.focusMinutes}
            onStart={(x) => void startFocus(x.id)}
            onLater={(x) => {
              const full = tasks.find((y) => y.id === x.id);
              if (full) postpone(full, day);
            }}
          />
        </HeroSlot>
      ) : null}

      <PersonFilter usedIds={(tasks ?? []).flatMap((x) => (x.personId ? [x.personId] : []))} />
      <div className={styles.layout}>
        <div className={styles.main}>
          <form ref={addRef} onSubmit={add} className={styles.add} data-keep-visible>
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

          {/* Tags are an advanced feature: the chips show in "Mehr Felder" mode or while a tag filters. */}
          {tagList.length > 0 && (advanced || tag) ? (
            <div className={styles.tagBar} role="group" aria-label={t.todos.tags.filter}>
              <button
                type="button"
                className={styles.tagChip}
                aria-pressed={tag === ''}
                onClick={() => setParam('tag', null)}
              >
                {t.todos.tags.all}
              </button>
              {tagList.map(([name, n]) => (
                <button
                  key={name}
                  type="button"
                  className={styles.tagChip}
                  aria-pressed={tag === name}
                  onClick={() => setParam('tag', tag === name ? null : name)}
                >
                  {`#${name} · ${n}`}
                </button>
              ))}
            </div>
          ) : null}
          {project ? (
            <div className={styles.projectBar} data-testid="project-bar">
              <div
                className={styles.projectTrack}
                role="progressbar"
                aria-label={currentList?.name}
                aria-valuemin={0}
                aria-valuemax={project.total}
                aria-valuenow={project.done}
              >
                <div
                  className={styles.projectFill}
                  style={{ width: `${project.total ? (project.done / project.total) * 100 : 0}%` }}
                />
              </div>
              <span>{t.todos.projectProgress(project.done, project.total)}</span>
            </div>
          ) : null}

          {inboxOpen.length > 0 && (selected === ALL || selected === INBOX_ID) ? (
            <div className={styles.waiting} data-testid="todos-inbox">
              <span className={styles.waitingText}>
                <strong>{t.todos.sort.hint(inboxOpen.length)}</strong>
              </span>
              <Button onClick={() => setSorting(true)}>{t.todos.sort.title}</Button>
            </div>
          ) : null}

          {tasks && top.length === 0 && pageView !== 'board' ? (
            <EmptyState title={t.todos.empty}>
              <StartDataButton moduleId="todos" />
            </EmptyState>
          ) : null}
          {pageView === 'board' ? (
            <BoardView
              tasks={top}
              day={day}
              onOpen={setEditing}
              onMove={moveTo}
              onTomorrow={(x) => postpone(x, day)}
            />
          ) : null}
          {pageView !== 'board' && top.length > 0 ? (
            <GroupedList listId={`todos-${selected}`} groups={groups} label={t.todos.title} />
          ) : null}
        </div>
      </div>

      <InboxSorter
        open={sorting}
        tasks={inboxOpen}
        lists={(lists ?? []) as Stored<TodoList>[]}
        onClose={() => setSorting(false)}
      />
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
