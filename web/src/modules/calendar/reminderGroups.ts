import { toDateString } from '@/core/time/dates';
import { timeGroupOf } from '@/core/time/groups';
import { nextOccurrenceAt, reminderStatus, sortReminders } from './reminders';
import type { CalendarEvent } from './schema';

type R = Pick<CalendarEvent, 'startDate' | 'startTime' | 'recurrence' | 'notify' | 'kind'> & {
  createdAt: number;
};

/** Groups of the reminders list, in display order. "done" = paused or over; shown folded. */
export type ReminderGroupId = 'today' | 'week' | 'later' | 'done';
export const REMINDER_GROUP_ORDER: readonly ReminderGroupId[] = ['today', 'week', 'later', 'done'];

/**
 * Sorts the reminders and puts them into "Heute", "Diese Woche" (tomorrow to the end of the week),
 * "Später" and "Erledigt" (paused or over), by the date of the next occurrence. Empty groups are
 * left out; `nowMs` comes from the caller (`now()`), so the result is fixed for a fixed clock.
 */
export function groupReminders<T extends R>(
  list: readonly T[],
  nowMs: number,
): { id: ReminderGroupId; items: T[] }[] {
  const day = toDateString(new Date(nowMs));
  const buckets = new Map<ReminderGroupId, T[]>();
  for (const r of sortReminders([...list], nowMs)) {
    const next = reminderStatus(r, nowMs) === 'upcoming' ? nextOccurrenceAt(r, nowMs) : undefined;
    const id: ReminderGroupId = !next
      ? 'done'
      : ((g) => (g === 'today' ? 'today' : g === 'tomorrow' || g === 'week' ? 'week' : 'later'))(
          timeGroupOf(next.date, day),
        );
    buckets.set(id, [...(buckets.get(id) ?? []), r]);
  }
  return REMINDER_GROUP_ORDER.flatMap((id) =>
    buckets.has(id) ? [{ id, items: buckets.get(id)! }] : [],
  );
}
