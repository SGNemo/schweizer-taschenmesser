import { firstOnOrAfter, nextOccurrence } from '@/core/recurrence/expand';
import { datesInRange } from '@/core/recurrence/expand';
import { toDateString, toEpoch } from '@/core/time/dates';
import type { Reminder } from './schema';

export interface Occurrence {
  date: string;
  time: string;
  /** Epoch ms. */
  at: number;
}

const occ = (date: string, time: string): Occurrence => ({ date, time, at: toEpoch(date, time) });

/** All occurrences on the dates within [from, to]. */
export function occurrencesInRange(
  r: Pick<Reminder, 'startDate' | 'time' | 'recurrence'>,
  from: string,
  to: string,
): Occurrence[] {
  return datesInRange(r.startDate, r.recurrence, from, to).map((d) => occ(d, r.time));
}

/** First occurrence at or after `nowMs`, or undefined when the reminder is over. */
export function nextOccurrenceAt(
  r: Pick<Reminder, 'startDate' | 'time' | 'recurrence'>,
  nowMs: number,
): Occurrence | undefined {
  const today = toDateString(new Date(nowMs));
  const first = r.recurrence
    ? firstOnOrAfter(r.recurrence, r.startDate, today)
    : r.startDate >= today
      ? r.startDate
      : undefined;
  if (!first) return undefined;
  const candidate = occ(first, r.time);
  if (candidate.at >= nowMs) return candidate;
  // Today's occurrence already passed.
  const later = r.recurrence ? nextOccurrence(r.recurrence, r.startDate, first) : undefined;
  return later ? occ(later, r.time) : undefined;
}

export type ReminderStatus = 'upcoming' | 'paused' | 'ended';

export function reminderStatus(r: Reminder, nowMs: number): ReminderStatus {
  if (!r.active) return 'paused';
  return nextOccurrenceAt(r, nowMs) ? 'upcoming' : 'ended';
}

/** Upcoming first (soonest), then paused, then ended. */
export function sortReminders<T extends Reminder & { createdAt: number }>(
  list: T[],
  nowMs: number,
): T[] {
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
