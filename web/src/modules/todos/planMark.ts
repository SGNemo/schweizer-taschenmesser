/**
 * What the ToDo side does with the planner's marks while the planner is off: nothing, except the one
 * idempotent clean-up of CONCEPT §2 – when a stored `_modules` row says the planner is switched off
 * and the sync gate is open, every planner-own `plannedFor` goes back to `planMark.prior` (or away)
 * and the mark is cleared. The service runs it from a live query over its inputs (`services.ts`), so
 * it needs no planner table and also catches a late write-back – a run in another tab, or a device
 * that was offline while another switched the planner off (a user date that never reached `prior` is
 * lost then – accepted).
 */
import { loadStoredModuleState } from '@/core/modules/activation';
import { syncSettled } from '@/core/sync/service';
import { taskRepo } from './repo';
import type { Task } from './schema';
import { isPlannerOwned } from './views';

export const PLANNER_ID = 'planner';

/** The patch that hands a task back to its user; empty when there is nothing of the planner on it. */
export function restorePatch(
  task: Pick<Task, 'plannedFor' | 'planMark'>,
): Partial<Pick<Task, 'plannedFor' | 'planMark'>> {
  if (!task.planMark) return {};
  if (!isPlannerOwned(task)) return { planMark: undefined };
  return { plannedFor: task.planMark.prior, planMark: undefined };
}

/** Runs the clean-up when it is allowed; returns how many tasks it touched. */
export async function cleanupPlanMarks(): Promise<number> {
  const stored = await loadStoredModuleState(PLANNER_ID);
  if (!stored || stored.enabled) return 0;
  if (!(await syncSettled(undefined, { wait: true }))) return 0;
  let n = 0;
  for (const task of await taskRepo.active().toArray()) {
    const patch = restorePatch(task);
    if (Object.keys(patch).length === 0) continue;
    await taskRepo.update(task.id, patch);
    n++;
  }
  return n;
}
