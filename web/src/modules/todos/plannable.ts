/**
 * The ToDos as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * every open top-level task that is not „Irgendwann“ (a recurring task exists once, so only the
 * current occurrence is listed). The write-back is the ownership rule of §2: `plannedFor` is the
 * planner's only while `planMark.date === plannedFor`; `prior` carries the user's own date it overwrote.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { today } from '@/core/time/now';
import { setDone, taskRepo } from './repo';
import type { PlanMark, Task } from './schema';
import { isPlannerOwned } from './views';

export const TASK_KIND = 'task';

/** The patch `onAssign(id, date, order)` writes; pure, so both LWW interleavings are testable. */
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

const source: PlannableSource = {
  async list() {
    const tasks = (await taskRepo.active().toArray()).filter(
      (t) => !t.done && !t.someday && !t.parentId,
    );
    return tasks.map((t): PlannableItem => ({
      id: t.id,
      kind: TASK_KIND,
      title: t.title,
      to: `/todos?open=${t.id}`,
      ...(t.estimateMin !== undefined ? { durationMin: t.estimateMin } : {}),
      priority: t.priority as 0 | 1 | 2 | 3,
      ...(t.dueDate ? { due: { date: t.dueDate, hard: false } } : {}),
      ...(t.startDate ? { earliest: t.startDate } : {}),
      ...(t.plannedFor ? { plannedFor: t.plannedFor } : {}),
      ...(t.planMark ? { planMark: t.planMark } : {}),
      ...(t.personId ? { personId: t.personId } : {}),
      ...(t.links?.[0] ? { link: t.links[0] } : {}),
      createdAt: t.createdAt,
    }));
  },
  async onAssign(id, date, order) {
    const task = await taskRepo.get(id);
    if (!task) return;
    const patch = assignPatch(task, date, order, today());
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
};

export default source;
