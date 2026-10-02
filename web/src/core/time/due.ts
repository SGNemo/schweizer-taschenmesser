import { daysBetween, formatDay } from './dates';

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/** How urgent a due date is relative to `today`; finished items are never "overdue". */
export function dueTone(dueDate: string | undefined, done: boolean, today: string): DueTone {
  if (!dueDate) return 'none';
  const d = daysBetween(today, dueDate);
  if (d < 0) return done ? 'later' : 'overdue';
  if (d === 0) return 'today';
  return d <= 3 ? 'soon' : 'later';
}

export interface DueState {
  tone: DueTone;
  /** Days until the date (negative = already past). */
  days: number;
  /** Short German label: "seit 3 Tagen", "Heute", "in 2 Tagen", or the date for later ones. */
  label: string;
}

/**
 * The one rule behind every due-date emphasis on the home screen: overdue (red + icon), today
 * (accent), soon (neutral, ≤ `soonDays`), later (muted). Finished items are never overdue.
 */
export function dueState(
  dueDate: string,
  today: string,
  opts: { done?: boolean; soonDays?: number } = {},
): DueState {
  const days = daysBetween(today, dueDate);
  const soonDays = opts.soonDays ?? 3;
  let tone: DueTone;
  if (days < 0) tone = opts.done ? 'later' : 'overdue';
  else if (days === 0) tone = 'today';
  else tone = days <= soonDays ? 'soon' : 'later';
  return { tone, days, label: dueLabel(tone, days, dueDate) };
}

function dueLabel(tone: DueTone, days: number, date: string): string {
  if (tone === 'overdue') return days === -1 ? 'seit gestern' : `seit ${-days} Tagen`;
  if (tone === 'today') return 'Heute';
  if (tone === 'soon') return days === 1 ? 'Morgen' : `in ${days} Tagen`;
  return formatDay(date, 'EEE, d. MMM');
}
