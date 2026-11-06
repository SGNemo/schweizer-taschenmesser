/**
 * „Fokus starten“ from a session of the plan (CONCEPT §7): the focus round of `core/focus` with the
 * session's minutes – not the ToDo's whole estimate – on the planner's own focus screen
 * (`/planner/focus/:item`, a focus path for the shell). No ToDo import: done goes through the contract.
 */
import { onFocusStart } from '@/core/focus/music';
import { MAX_SESSION_MS, startSession } from '@/core/focus/session';
import { getFocusSession, saveFocusSession } from '@/core/focus/state';
import { now } from '@/core/time/now';

/** The focus screen of a unit (`<module>:<id>#<k>`, encoded: ids may hold any character). */
export const planFocusPath = (unitId: string): string =>
  `/planner/focus/${encodeURIComponent(unitId)}`;

/** Minutes of a round: the session's own length, at least 5, at most the longest round. */
export const planFocusMinutes = (minutes: number): number =>
  Math.min(Math.max(5, Math.round(minutes)), MAX_SESSION_MS / 60_000);

/**
 * Starts the round for a unit. A round for something else is only replaced with `replace` (the focus
 * screen asks first); returns false when it kept the running one.
 */
export async function beginPlanFocus(
  unit: { unitId: string; title: string; minutes: number },
  opts: { replace?: boolean } = {},
): Promise<boolean> {
  const running = await getFocusSession();
  if (running && running.taskId !== unit.unitId && !opts.replace) return false;
  if (running?.taskId === unit.unitId) return true;
  await saveFocusSession(
    startSession(
      { id: unit.unitId, title: unit.title },
      planFocusMinutes(unit.minutes),
      now(),
      planFocusPath(unit.unitId),
    ),
  );
  void onFocusStart();
  return true;
}
