/**
 * „Rest verteilen“ in the evening (use case „Wochenende retten“, F3): where its preview opens and when it is
 * offered. Pure and light, so the widget does not load the planner's services for it.
 */
import { EVENING_HOUR } from '@/core/settings/focus';
import type { BoardDay, BoardRow, WaitingRow } from './board';

/** The planner page with the preview of „Rest verteilen“ open (head link, widget, `plan.restRequested`). */
export const REST_PATH = '/planner?rest=1';

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

/** The head says „Bald ist Tagesende.“ for this many minutes before the day end. */
export const DAY_END_LEAD_MIN = 30;

/**
 * „Bald ist Tagesende.“ (package 6): from 30 minutes before the day end up to it, under `focus.eveningWrapUp`, in the
 * app only. A day end of '00:00' is midnight (the half hour before it is 23:30–24:00). No line after the day end, no
 * count and no history.
 */
export function dayEndNear(
  eveningWrapUp: boolean,
  clock: number,
  dayEnd: string | undefined,
): boolean {
  if (!eveningWrapUp || !dayEnd) return false;
  const d = new Date(clock);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const endMin = Number(dayEnd.slice(0, 2)) * 60 + Number(dayEnd.slice(3, 5));
  const left = (endMin - nowMin + 1440) % 1440;
  return left > 0 && left <= DAY_END_LEAD_MIN;
}

/**
 * The one evening line under the planner head (REVIEW-FABLE R11: one line at a time): near the day end the
 * sentence, with the „Rest verteilen“ link while today holds something open; else the link from 17:00; else
 * nothing (the Monday „Woche prüfen“ shows only when this is `undefined`).
 */
export type EveningLine = { kind: 'dayEnd'; rest: boolean } | { kind: 'rest' };

export function eveningLine(
  eveningWrapUp: boolean,
  clock: number,
  dayEnd: string | undefined,
  today: Pick<BoardDay, 'date' | 'rows'> | undefined,
): EveningLine | undefined {
  const open = !!today && today.rows.some((r) => r.item?.pinned !== today.date);
  if (dayEndNear(eveningWrapUp, clock, dayEnd)) return { kind: 'dayEnd', rest: open };
  return restOffered(eveningWrapUp, clock, today) ? { kind: 'rest' } : undefined;
}

/**
 * Item key → the hard deadline a row shows as „Frist …“ (the board's rule: the planner row's hard due, else the
 * source's), for the preview (C5). A soft due (a ToDo's date, a routine's next day) is no deadline here.
 */
export function duesOf(board: {
  days: readonly { rows: readonly Pick<BoardRow, 'itemKey' | 'hardDue'>[] }[];
  waiting: readonly Pick<WaitingRow, 'itemKey' | 'item' | 'entry'>[];
}): Record<string, string> {
  const dues: Record<string, string> = {};
  for (const r of board.days.flatMap((d) => d.rows)) if (r.hardDue) dues[r.itemKey] = r.hardDue;
  for (const r of board.waiting) {
    const due = r.item?.due?.hard
      ? r.item.due.date
      : r.entry?.due?.hard
        ? r.entry.due.date
        : undefined;
    if (due) dues[r.itemKey] = due;
  }
  return dues;
}
