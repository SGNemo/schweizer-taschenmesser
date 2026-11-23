/**
 * The ToDos as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * every open top-level task that is not „Irgendwann“ (a recurring task exists once, so only the
 * current occurrence is listed). The write-back is the ownership rule of §2: `plannedFor` is the
 * planner's only while `planMark.date === plannedFor`; `prior` carries the user's own date it overwrote.
 */
import { fromLegacy } from '@/core/entitylinks/types';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { today } from '@/core/time/now';
import { nextInstanceId } from './logic';
import { restorePatch } from './planMark';
import { createNextInstance, deleteTask, setDone, taskRepo } from './repo';
import type { PlanMark, Task } from './schema';
import { isPlannerOwned, movePatch } from './views';

export const TASK_KIND = 'task';

/**
 * The patch `onAssign(id, date, order)` writes; pure, so both LWW interleavings are testable. Without a
 * date (waiting, excluded, done) `prior` comes back only when it is not past – a past date would put
 * the thing on the overdue list the planner just took it from (CONCEPT §2); switching the module off
 * (`onRelease`) hands it back unconditionally.
 */
export function assignPatch(
  task: Pick<Task, 'plannedFor' | 'planMark'>,
  date: string | undefined,
  order: number | undefined,
  day: string,
): Partial<Pick<Task, 'plannedFor' | 'planMark'>> {
  const own = isPlannerOwned(task);
  if (date === undefined) {
    if (own) {
      // Taken out of the plan: the user's date comes back unless it lies in the past (that would put the
      // thing on today's card by itself).
      const prior = task.planMark?.prior;
      return { plannedFor: prior && prior >= day ? prior : undefined, planMark: undefined };
    }
    // A user's date is never touched; only a mark for another day is cleaned up.
    return task.planMark ? { planMark: undefined } : {};
  }
  if (order === undefined) {
    // No order = no ownership: the date stands as if the user had set it.
    const patch: Partial<Pick<Task, 'plannedFor' | 'planMark'>> = {};
    if (task.plannedFor !== date) patch.plannedFor = date;
    if (task.planMark) patch.planMark = undefined;
    return patch;
  }
  // The user's own date (not planner-own, not a stale mark) is kept in `prior` before the first overwrite;
  // a planner-own value keeps the prior it already carries.
  const prior = own ? task.planMark?.prior : task.plannedFor;
  const mark: PlanMark = { date, order, ...(prior ? { prior } : {}) };
  const same =
    task.plannedFor === date &&
    task.planMark?.date === mark.date &&
    task.planMark.order === mark.order &&
    task.planMark.prior === mark.prior;
  return same ? {} : { plannedFor: date, planMark: mark };
}

/** The planner's view of one open top-level task. */
const itemOf = (t: Task & { id: string; createdAt: number }): PlannableItem => ({
  id: t.id,
  kind: TASK_KIND,
  title: t.title,
  to: `/todos?open=${t.id}`,
  ...(t.estimateMin !== undefined ? { durationMin: t.estimateMin } : {}),
  priority: t.priority as 0 | 1 | 2 | 3,
  ...(t.dueDate
    ? { due: { date: t.dueDate, hard: false, ...(t.dueTime ? { time: t.dueTime } : {}) } }
    : {}),
  ...(t.startDate ? { earliest: t.startDate } : {}),
  ...(t.plannedFor ? { plannedFor: t.plannedFor } : {}),
  ...(t.planMark ? { planMark: t.planMark } : {}),
  ...(t.personId ? { personId: t.personId } : {}),
  // Every link travels (`links`); `link` stays the first one for readers of before the link contract.
  ...(t.links?.[0] ? { link: t.links[0], links: t.links.map(fromLegacy) } : {}),
  createdAt: t.createdAt,
});

const source: PlannableSource = {
  async list() {
    const tasks = (await taskRepo.active().toArray()).filter(
      (t) => !t.done && !t.someday && !t.parentId,
    );
    return tasks.map(itemOf);
  },
  // „Nächste Wochen“ in the planner is „Irgendwann“ here: open, not crossed out, out of the plan's listing.
  async listLater() {
    const tasks = (await taskRepo.active().toArray()).filter(
      (t) => !t.done && t.someday && !t.parentId,
    );
    return tasks.map(itemOf);
  },
  async onLater(id, later) {
    const task = await taskRepo.get(id);
    if (!task || task.done || !!task.someday === later) return;
    // To later: the same patch as the board's „Irgendwann“ column (the date goes, the thing stays). Back: only the flag.
    await taskRepo.update(id, later ? movePatch(task, 'someday', today()) : { someday: undefined });
  },
  async onAssign(id, date, order) {
    const task = await taskRepo.get(id);
    if (!task) return;
    const patch = assignPatch(task, date, order, today());
    if (Object.keys(patch).length > 0) await taskRepo.update(id, patch);
  },
  async onRelease(id) {
    const task = await taskRepo.get(id);
    if (!task) return;
    const patch = restorePatch(task);
    if (Object.keys(patch).length > 0) await taskRepo.update(id, patch);
  },
  async onDone(id) {
    const task = await taskRepo.get(id);
    if (task && !task.done) await setDone(task, true);
  },
  async onEstimate(id, minutes) {
    const task = await taskRepo.get(id);
    if (task && task.estimateMin !== minutes) await taskRepo.update(id, { estimateMin: minutes });
  },
  // „Als Pause …“: the ToDo goes (with its subtasks, like a delete in the list), so leisure never waits as an open
  // task (morning digest, „Erledigt heute“). A recurring ToDo keeps its series: its next instance is created as a
  // tick would create it, but nothing is ticked (no `todos.task.completed`, no `completedAt`). The restore brings
  // back the removed rows and takes back a next instance it created (idempotent next to the journal).
  async onRemove(id) {
    const task = await taskRepo.get(id);
    if (!task || task.done) return undefined;
    const ids = [
      id,
      ...(await taskRepo.table.where('parentId').equals(id).toArray())
        .filter((t) => t.deletedAt === null)
        .map((t) => t.id),
    ];
    // A next instance this call creates from nothing is this call's to take back too (also outside the planner's
    // journal); one that existed as a tombstone is left to the journal, whose steps undo its restore and update.
    const nextId = task.recurrence ? nextInstanceId(task) : undefined;
    const fresh = nextId ? !(await taskRepo.table.get(nextId)) : false;
    if (task.recurrence) await createNextInstance(task);
    await deleteTask(id);
    return async () => {
      for (const x of ids) await taskRepo.restore(x);
      const next = fresh && nextId ? await taskRepo.get(nextId) : undefined;
      if (next && !next.done) await deleteTask(next.id);
    };
  },
};

export default source;
