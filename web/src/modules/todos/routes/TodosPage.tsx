import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { copyData } from '@/core/db/copy';
import type { Stored } from '@/core/db/types';
import { undoable } from '@/core/undo';
import { skipSuggestion } from '@/core/focus/state';
import { usePageChrome } from '@/core/shell/pageChrome';
import { useWriteAvailable, useWriteLabel } from '@/core/shell/writeAvailable';
import { useModuleStates } from '@/core/modules/activation';
import { planFacts, requestManyIntoPlan } from '@/core/entitylinks/planRow';
import { useFocusSettings } from '@/core/settings/focus';
import { useSettings } from '@/core/settings/settings';
import { formatDay, relativeDayLabel, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { groupByTime } from '@/core/time/groups';
import { DATE_PRESETS, presetDate } from '@/core/time/quickShift';
import { changeWithUndo, deleteWithUndo, undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import {
  Button,
  EmptyState,
  GroupedList,
  ItemList,
  Icon,
  ItemRow,
  PageAction,
  PageHeader,
  Tabs,
  Progress,
  RowMenu,
  SelectionBar,
  SplitView,
  type RowMenuItem,
  useAdvancedMenuItem,
  useOpenParam,
  useSelection,
  useSplitView,
} from '@/ui';
import { AddTaskDialog } from '../components/AddTaskDialog';
import { TaskDetail } from '../components/TaskDetail';
import { BoardView } from '../components/BoardView';
import { InboxSorter } from '../components/InboxSorter';
import { TodayCard } from '../components/TodayCard';
import { PlanDayDialog } from '../components/PlanDayDialog';
import { PlanMark } from '../components/PlanMark';
import {
  PLAN_FILTERS,
  passesPlanFilter,
  planStateOf,
  plannerPath,
  readPlanFilter,
  writePlanFilter,
  type PlanFilter,
  type PlanState,
} from '../planState';
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
import {
  movePatch,
  overdueTasks,
  TODO_VIEWS,
  userPlannedFor,
  viewOf,
  type TodoView,
} from '../views';
import { deleteTask, ensureInbox, INBOX_ID, listRepo, setDone, taskRepo } from '../repo';
import type { Task, TodoList } from '../schema';
import { settings } from '../settings';
import styles from './todos.module.css';
import { useStartDataItems } from '@/core/importer/StartDataMenu';
import { SignatureMark } from '@/ui/identity';

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
  /** While the planner is on: where the task stands in the plan (a quiet line under the title; todos-plan-state). */
  plan?: PlanState;
  /** „im Plan: Mi“ → the planner on that day; „noch nicht im Plan“ / „In den Plan …“ → the day choice. */
  onPlanShow?: (task: StoredTask, plan: PlanState) => void;
  onPlanChoose?: (task: StoredTask) => void;
  /** The selection of „Auswählen“: a checkbox on the row. */
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (task: StoredTask, extend: boolean) => void;
  /** "n in Folge" of the task's series (shown on the open instance only). */
  streaks?: Map<string, Streak>;
  onToggle: (task: StoredTask, done: boolean) => void;
  onOpen: (task: StoredTask) => void;
  /** Master–detail (wide page): the id of the task shown in the panel, and the way into its dialog. */
  currentId?: string;
  onEdit?: (task: StoredTask) => void;
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
  plan,
  onPlanShow,
  onPlanChoose,
  selectable,
  selected,
  onSelectChange,
  streaks,
  onToggle,
  onOpen,
  currentId,
  onEdit,
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
  // "Auf heute" is the first entry of the row's menu (the phone's sheet) for every task that is not due today yet:
  // one tap after "⋯" (UI audit 2026-11, click path "ToDo auf heute"). Swiping stays.
  const todayItem: RowMenuItem[] =
    task.dueDate !== day
      ? [
          {
            id: 'today',
            label: t.todos.moveToday,
            onSelect: () => moveDue(task, presetDate('today', day)),
          },
        ]
      : [];
  const dueMenu: RowMenuItem[] = DATE_PRESETS.filter((p) => p !== 'today').map((p) => ({
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
  const planItem: RowMenuItem[] =
    plan && plan.kind !== 'none' && onPlanChoose
      ? [{ id: 'to-plan', label: t.todos.plan.action, onSelect: () => onPlanChoose(task) }]
      : [];
  return (
    <ItemRow
      title={task.title}
      done={task.done}
      current={currentId === task.id}
      selectable={selectable}
      selected={selected}
      onSelectChange={onSelectChange ? (_, extend) => onSelectChange(task, extend) : undefined}
      below={
        plan && plan.kind !== 'none' ? (
          <PlanMark
            state={plan}
            day={day}
            title={task.title}
            onShow={() => onPlanShow?.(task, plan)}
            onChoose={() => onPlanChoose?.(task)}
          />
        ) : undefined
      }
      tone={tone === 'overdue' && !waiting ? 'overdue' : tone === 'today' ? 'today' : undefined}
      className={sub ? styles.sub : undefined}
      onOpen={() => onOpen(task)}
      onSwipeRight={() => onToggle(task, !task.done)}
      swipeRightLabel={task.done ? t.todos.markedOpen : t.todos.markedDone}
      onSwipeLeft={task.done ? undefined : () => postpone(task, day)}
      swipeLeftLabel={t.focus.next.later}
      menu={[
        // On a wide page the row shows the task in the panel: its dialog is also one entry here.
        ...(onEdit
          ? [{ id: 'edit', label: t.actions.edit, onSelect: () => onEdit(task) } as RowMenuItem]
          : []),
        ...planItem,
        ...(task.done ? [] : [...todayItem, laterItem, ...dueMenu]),
        ...(task.done ? [] : prioMenu),
        {
          id: 'duplicate',
          label: t.actions.duplicate,
          onSelect: () =>
            void undoableWithToast(t.actions.duplicated, t.actions.duplicated, () =>
              // A copy is the user's: the planner's mark stays with the original.
              taskRepo.create({
                ...copyData(task),
                done: false,
                completedAt: undefined,
                planMark: undefined,
              }),
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
            className={styles.rowQuick}
            onClick={() => moveDue(task, presetDate('today', day))}
            data-testid="move-today"
          >
            {t.todos.moveToday}
          </Button>
        ) : quickTomorrow && !task.done ? (
          <Button
            variant="ghost"
            size="sm"
            className={styles.rowQuick}
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
              {(() => {
                const label = waiting
                  ? formatDay(task.dueDate, 'EEE, d. MMM')
                  : relativeDayLabel(task.dueDate, day);
                return task.dueTime ? t.todos.dueAt(label, task.dueTime) : label;
              })()}
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
              currentId={currentId}
              onEdit={onEdit}
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
  // While the planner module is on, it distributes the open things: the ToDo page's „Neu planen“ and „Alle auf heute“
  // (which rewrite dates) step back, a planner-set later day wins over an older due date (Heute counts what the plan
  // counts, N02) and shows „im Plan“ in Bald.
  const plannerOn = useModuleStates()?.planner === true;
  // „Alle · Noch nicht im Plan · Im Plan“ (todos-plan-state): remembered per device; without the planner there is none.
  const [planFilterPick, setPlanFilterPick] = useState<PlanFilter>(readPlanFilter);
  const planFilter: PlanFilter = plannerOn ? planFilterPick : 'all';
  const pickPlanFilter = (f: PlanFilter) => {
    setPlanFilterPick(f);
    writePlanFilter(f);
  };
  const [selecting, setSelecting] = useState(false);
  const [planFor, setPlanFor] = useState<{ ids: string[]; title: string } | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  // The page's one entry: the head's action, the plus on the phone, `?new=1` (quick add) and a shared title
  // (`/todos?new=1&title=…`, from the share page) all open the same small dialog.
  const [adding, setAdding] = useState<{ title: string } | null>(null);
  const [editing, setEditing] = useState<StoredTask | null>(null);
  useOpenParam((id) => taskRepo.get(id), setEditing);
  const [listTarget, setListTarget] = useState<Stored<TodoList> | 'new' | null>(null);
  // Master–detail (layout `split`): on a wide page a task opens in the panel beside the list, below that width
  // in its dialog (a sheet on the phone). The board has no panel: its four columns take the page.
  const wide = useSplitView();
  const [picked, setPicked] = useState<{ id: string } | 'closed' | null>(null);
  const [sorting, setSorting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const advancedItem = useAdvancedMenuItem('todos');
  const advanced = advancedItem.checked === true;
  const writeAvailable = useWriteAvailable('todos');
  const writeLabel = useWriteLabel();
  const openWrite = useUiStore((s) => s.openWritePalette);
  const toast = useUiStore((s) => s.toast);
  // The AI entry lives in the page's "⋯" menu.
  usePageChrome({ writeInMenu: true });

  useEffect(() => {
    if (lists && lists.length === 0) void ensureInbox(t.todos.inbox);
  }, [lists]);

  // `?new=1` (Quick-Add) opens the dialog; derived from the URL, as the calendar does it.
  const fromUrl = params.get('new') ? { title: params.get('title') ?? '' } : null;
  const addTarget = adding ?? fromUrl;
  const closeAdd = () => {
    setAdding(null);
    if (params.get('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('title');
      setParams(next, { replace: true });
    }
  };

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
  // „fest“ and „Nicht planen“ live in the planner: read from its rows like the „Im Plan“ entries of other modules.
  const openIds = useMemo(
    () =>
      (tasks ?? [])
        .filter((x) => !x.done && !x.someday && !x.parentId)
        .map((x) => x.id)
        .sort()
        .join(','),
    [tasks],
  );
  const facts = useLiveQuery(
    () => (plannerOn ? planFacts('todos', openIds ? openIds.split(',') : []) : undefined),
    [plannerOn, openIds],
  );
  const planOf = useMemo(
    () =>
      (x: StoredTask): PlanState =>
        // While „fest“ / „Nicht planen“ load, no mark yet (a „Nicht planen“ never flashes as „noch nicht im Plan“).
        plannerOn && facts ? planStateOf(x, day, facts.get(x.id)) : { kind: 'none' },
    [plannerOn, day, facts],
  );
  const scoped = useMemo(() => {
    const all = tasks ?? [];
    const matches = (x: StoredTask) =>
      (!forPerson || x.personId === forPerson) && (!tag || !!x.tags?.includes(tag));
    if (pageView === 'list') {
      const inScope =
        selected === SOMEDAY
          ? all.filter((x) => x.someday)
          : all.filter(
              (x) =>
                isActionable(x) &&
                // Not started yet = under "Demnächst", not in the plain list.
                !(x.startDate && x.startDate > day && !x.parentId) &&
                (selected === ALL || x.listId === selected),
            );
      return inScope.filter((x) => (showDone || !x.done) && matches(x));
    }
    // A view picks top-level tasks by their dates; their subtasks and checklist ride along.
    const inList = (x: StoredTask) =>
      selected === ALL || selected === SOMEDAY || x.listId === selected;
    const tops = all.filter(
      (x) =>
        !x.parentId &&
        inList(x) &&
        matches(x) &&
        (pageView === 'board' || viewOf(x, day, plannerOn) === pageView),
    );
    if (pageView === 'board') return tops;
    const ids = new Set(tops.map((x) => x.id));
    return [...tops, ...all.filter((x) => x.parentId && ids.has(x.parentId))];
  }, [tasks, selected, showDone, forPerson, tag, pageView, day, plannerOn]);
  // The plan filter picks top-level tasks; their subtasks ride along (only the main task is a thing of the plan).
  const visible = useMemo(() => {
    if (planFilter === 'all') return scoped;
    const kept = new Set(
      scoped.filter((x) => !x.parentId && passesPlanFilter(planOf(x), planFilter)).map((x) => x.id),
    );
    return scoped.filter((x) => (x.parentId ? kept.has(x.parentId) : kept.has(x.id)));
  }, [scoped, planFilter, planOf]);
  // The number at „Noch nicht im Plan“: what that filter shows in this view, list, tag and person.
  const unplannedCount = useMemo(
    () => scoped.filter((x) => !x.parentId && planOf(x).kind === 'unplanned').length,
    [scoped, planOf],
  );
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

  async function add(title: string) {
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
        ...(typed.dueDate && typed.dueTime ? { dueTime: typed.dueTime } : {}),
        ...(typed.estimateMin ? { estimateMin: typed.estimateMin } : {}),
        ...(typed.note ? { note: typed.note } : {}),
        ...((selected === SOMEDAY || pageView === 'someday') && !typed.dueDate
          ? { someday: true }
          : {}),
        ...(pageView === 'today' && !typed.dueDate ? userPlannedFor({}, day) : {}),
      }),
    );
    toast(t.todos.added);
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

  const split = wide && pageView !== 'board';
  // The panel shows the picked task, else the first row as the list shows it (open tasks by time, then done ones).
  const firstShown = useMemo(() => {
    const open = top.filter((x) => !x.done);
    return groupByTime(open, (x) => x.dueDate, day)[0]?.items[0] ?? top.find((x) => x.done);
  }, [top, day]);
  const detail = !split
    ? undefined
    : picked === 'closed'
      ? undefined
      : ((picked ? visible.find((x) => x.id === picked.id) : undefined) ?? firstShown);
  const openRow = (task: StoredTask) => (split ? setPicked({ id: task.id }) : setEditing(task));

  const streaks = useMemo(
    () => (focus.streaks && tasks ? streaksOf(tasks, day) : undefined),
    [focus.streaks, tasks, day],
  );
  // „Auswählen“ (todos-plan-state): several tasks into the plan at once. Only things of the plan can be ticked; the
  // order is the list's, so Shift-click takes the range between.
  const pickable = useMemo(
    () => top.filter((x) => planOf(x).kind !== 'none').map((x) => x.id),
    [top, planOf],
  );
  const selection = useSelection(pickable);
  const chosen = selection.ids;
  const stopSelecting = () => {
    setSelecting(false);
    selection.clear();
  };
  // The planner switched off, or nothing left to tick: the mode ends by itself (adjusted while rendering).
  if (selecting && (!plannerOn || pickable.length === 0)) {
    setSelecting(false);
    selection.clear();
  }
  function showInPlanner(task: StoredTask, plan: PlanState) {
    const to = plannerPath(plan, task.id);
    if (to) void navigate(to);
  }
  function intoPlan(ids: readonly string[], date: string | null) {
    stopSelecting();
    void requestManyIntoPlan(
      ids.map((id) => ({ module: 'todos', id })),
      date,
    );
  }
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
        plan={planOf(task)}
        onPlanShow={showInPlanner}
        onPlanChoose={(x) => setPlanFor({ ids: [x.id], title: t.todos.plan.title(x.title) })}
        selectable={selecting && planOf(task).kind !== 'none'}
        selected={selection.isSelected(task.id)}
        onSelectChange={(x, extend) => selection.toggle(x.id, extend)}
        streaks={streaks}
        onToggle={toggle}
        onOpen={openRow}
        currentId={detail?.id}
        onEdit={split ? setEditing : undefined}
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
        g.id === 'overdue' && focus.calmAttention && !plannerOn ? (
          <div className={styles.waiting} data-testid="todos-waiting">
            <span className={styles.waitingText}>
              <span>{t.focus.waiting.replanHint}</span>
            </span>
            <Button onClick={replanNow}>{t.focus.waiting.replan}</Button>
          </div>
        ) : g.id === 'overdue' && !plannerOn ? (
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
  }, [
    top,
    children,
    tasks,
    day,
    selected,
    focus.calmAttention,
    lists,
    pageView,
    plannerOn,
    split,
    detail?.id,
    planOf,
    selecting,
    selection.selected,
  ]);
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

  // The plan filter emptied the view: a plain line, never the empty state of a page without tasks (the filter stays).
  const filteredOut = planFilter !== 'all' && top.length === 0 && scoped.some((x) => !x.parentId);
  const isEmpty = !!tasks && top.length === 0 && !filteredOut && pageView !== 'board';
  const startItems = useStartDataItems('todos');
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
    { ...advancedItem, group: t.todos.moreOptions },
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
    // C23: import and setup live here, not in the empty state.
    ...startItems.map((i) => ({ ...i, group: t.todos.moreOptions })),
  ];

  return (
    <>
      <PageHeader
        title={t.todos.title}
        views={
          <Tabs
            label={t.todos.views.label}
            value={pageView}
            options={PAGE_VIEWS.map((v) => ({
              value: v,
              label: v === 'list' ? t.todos.views.all : t.todos.views[v],
            }))}
            onChange={(v) => setParam('view', v === 'list' ? null : v)}
          />
        }
        besideContent
      >
        {/* While nothing is there the empty state owns the filled button of the view. */}
        <PageAction
          short={t.todos.addShort}
          variant={isEmpty ? 'secondary' : 'primary'}
          disabled={!targetListId}
          onClick={() => setAdding({ title: '' })}
        >
          <Icon name="plus" size={18} />
          {t.todos.newTask}
        </PageAction>
        <RowMenu
          label={t.todos.moreOptions}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={pageMenu}
        />
      </PageHeader>

      {/* The first row of the page: what is next today. On the phone the page's "⋯" menu lies beside it
          (`besideContent`), so the row is always there and keeps its height while the tasks load. An empty view
          says "nothing" once, in its empty state: the row then keeps only its room (`quiet`). */}
      <TodayCard
        tasks={tasks}
        day={day}
        focusMinutes={focus.focusMinutes}
        planner={plannerOn}
        quiet={isEmpty}
        onStart={(x) => void startFocus(x.id)}
        onLater={(x) => {
          const full = tasks?.find((y) => y.id === x.id);
          if (full) postpone(full, day);
        }}
      />

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

      <PersonFilter usedIds={(tasks ?? []).flatMap((x) => (x.personId ? [x.personId] : []))} />
      <div className={styles.layout}>
        <div className={styles.main}>
          {plannerOn && !isEmpty ? (
            <div className={styles.planBar}>
              <div className={styles.planFilter} role="group" aria-label={t.todos.plan.filter}>
                {PLAN_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={styles.tagChip}
                    aria-pressed={planFilter === f}
                    onClick={() => pickPlanFilter(f)}
                    data-testid={`plan-filter-${f}`}
                  >
                    {f === 'unplanned'
                      ? `${t.todos.plan.filters[f]} · ${unplannedCount}`
                      : t.todos.plan.filters[f]}
                  </button>
                ))}
              </div>
              {pageView !== 'board' && pickable.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={selecting}
                  onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                  data-testid="todos-select"
                >
                  {t.todos.plan.select}
                </Button>
              ) : null}
            </div>
          ) : null}
          {selecting ? (
            <SelectionBar count={chosen.length} onCancel={stopSelecting}>
              <Button
                variant="primary"
                onClick={() =>
                  setPlanFor({ ids: chosen, title: t.todos.plan.titleMany(chosen.length) })
                }
                data-testid="todos-to-plan"
              >
                {t.todos.plan.action}
              </Button>
              {chosen.length < pickable.length ? (
                <Button variant="ghost" onClick={selection.selectAll}>
                  {t.todos.plan.selectAll}
                </Button>
              ) : null}
            </SelectionBar>
          ) : null}
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

          <SplitView
            enabled={split && detail !== undefined}
            asideLabel={t.todos.detail.label}
            aside={
              detail ? (
                <TaskDetail
                  task={detail}
                  listName={listName(detail.listId)}
                  person={personName(people, detail.personId)}
                  subtasks={(tasks ?? []).filter((x) => x.parentId === detail.id)}
                  day={day}
                  onEdit={() => setEditing(detail)}
                  onFocus={
                    detail.done || detail.parentId ? undefined : () => void startFocus(detail.id)
                  }
                  onClose={() => setPicked('closed')}
                />
              ) : null
            }
          >
            {filteredOut && pageView !== 'board' ? (
              <p className={styles.planHint} data-testid="plan-filter-empty">
                {t.todos.plan.filterEmpty}
              </p>
            ) : null}
            {isEmpty ? (
              <EmptyState
                title={t.todos.empty}
                testId="todos-empty"
                motif={<SignatureMark id="todayCard" size={64} />}
              >
                {/* B6: the motif, one sentence, one verb. */}
                <Button
                  variant="primary"
                  onClick={() => setAdding({ title: '' })}
                  data-testid="todos-empty-add"
                >
                  {t.todos.emptyAction}
                </Button>
              </EmptyState>
            ) : null}
            {pageView === 'board' ? (
              <BoardView
                tasks={top}
                day={day}
                onOpen={setEditing}
                onMove={moveTo}
                onTomorrow={(x) => postpone(x, day)}
                planner={plannerOn}
              />
            ) : null}
            {pageView !== 'board' && top.length > 0 ? (
              <GroupedList listId={`todos-${selected}`} groups={groups} label={t.todos.title} />
            ) : null}
          </SplitView>
        </div>
      </div>

      {planFor ? (
        <PlanDayDialog
          open
          title={planFor.title}
          day={day}
          onPick={(date) => intoPlan(planFor.ids, date)}
          onClose={() => setPlanFor(null)}
        />
      ) : null}
      <AddTaskDialog
        open={addTarget !== null}
        initialTitle={addTarget?.title}
        ready={!!targetListId}
        onAdd={add}
        onClose={closeAdd}
      />
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
