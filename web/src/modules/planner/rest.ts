/**
 * „Rest verteilen“ in the evening (use case „Wochenende retten“, F3): where its preview opens and when it is
 * offered. Pure and light, so the widget does not load the planner's services for it.
 */
import type { BoardDay } from './board';

/** The planner page with the preview of „Rest verteilen“ open (head link, widget, `plan.restRequested`). */
export const REST_PATH = '/planner?rest=1';

/** Evenings start at this hour (local), as on the ToDo widget. */
export const EVENING_HOUR = 17;

/**
 * Offered from 17:00 under `focus.eveningWrapUp`, and only while today holds something the ops would move (a thing
 * nailed to today stays, so it alone does not count). Never with a count of what is left.
 */
export function restOffered(
  eveningWrapUp: boolean,
  clock: number,
  today: Pick<BoardDay, 'date' | 'rows'> | undefined,
): boolean {
  if (!eveningWrapUp || !today || new Date(clock).getHours() < EVENING_HOUR) return false;
  return today.rows.some((r) => r.item?.pinned !== today.date);
}
