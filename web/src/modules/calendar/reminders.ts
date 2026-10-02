import { datesInRange, firstOnOrAfter, nextOccurrence } from '@/core/recurrence/expand';
import { toDateString, toEpoch } from '@/core/time/dates';
import type { CalendarEvent } from './schema';

/** Reminders are events of the kind "reminder" that notify; the time of day is their start time. */
type R = Pick<CalendarEvent, 'startDate' | 'startTime' | 'recurrence' | 'notify' | 'kind'>;

export const REMINDER_DEFAULT_TIME = '09:00';

export const isReminder = (e: Pick<CalendarEvent, 'kind'>): boolean => e.kind === 'reminder';

/** Paused = the notification is switched off; the reminder stays in the list but not on the calendar. */
export const isActive = (e: Pick<CalendarEvent, 'notify'>): boolean => e.notify?.enabled !== false;

export interface Occurrence {
  date: string;
  time: string;
  /** Epoch ms. */
  at: number;
}
const occ = (date: string, time: string): Occurrence => ({ date, time, at: toEpoch(date, time) });
const timeOf = (r: Pick<R, 'startTime'>) => r.startTime ?? REMINDER_DEFAULT_TIME;

/** All occurrences on the dates within [from, to]. */
export function occurrencesInRange(r: R, from: string, to: string): Occurrence[] {
  return datesInRange(r.startDate, r.recurrence, from, to).map((d) => occ(d, timeOf(r)));
}

/** First occurrence at or after `nowMs`, or undefined when the reminder is over. */
export function nextOccurrenceAt(r: R, nowMs: number): Occurrence | undefined {
  const today = toDateString(new Date(nowMs));
  const first = r.recurrence
    ? firstOnOrAfter(r.recurrence, r.startDate, today)
    : r.startDate >= today
      ? r.startDate
      : undefined;
  if (!first) return undefined;
  const candidate = occ(first, timeOf(r));
  if (candidate.at >= nowMs) return candidate;
  // Today's occurrence already passed.
  const later = r.recurrence ? nextOccurrence(r.recurrence, r.startDate, first) : undefined;
  return later ? occ(later, timeOf(r)) : undefined;
}

export type ReminderStatus = 'upcoming' | 'paused' | 'ended';

export function reminderStatus(r: R, nowMs: number): ReminderStatus {
  if (!isActive(r)) return 'paused';
  return nextOccurrenceAt(r, nowMs) ? 'upcoming' : 'ended';
}

/** Upcoming first (soonest), then paused, then ended. */
export function sortReminders<T extends R & { createdAt: number }>(list: T[], nowMs: number): T[] {
  const rank = { upcoming: 0, paused: 1, ended: 2 } as const;
  return [...list].sort((a, b) => {
    const sa = reminderStatus(a, nowMs);
    const sb = reminderStatus(b, nowMs);
    if (sa !== sb) return rank[sa] - rank[sb];
    const na = nextOccurrenceAt(a, nowMs)?.at ?? 0;
    const nb = nextOccurrenceAt(b, nowMs)?.at ?? 0;
    return na - nb || a.createdAt - b.createdAt;
  });
}
