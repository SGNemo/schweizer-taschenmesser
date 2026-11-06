import { capitalize, relativeDays } from '@/core/i18n/format';
import { t } from '@/strings';
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
  /** Short label: "war am Di. fällig", "Heute", "in 2 Tagen", or the date for later ones. */
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

/**
 * The day a past date was (N08): the short weekday within the last week ("Di."), the date before that
 * ("17. Sep."). Never a count of days, which would grow every day (FOCUS-GUIDELINES text rules).
 */
export function pastDay(date: string, today: string): string {
  return dayOf(date, daysBetween(today, date));
}

const dayOf = (date: string, days: number) => formatDay(date, days >= -6 ? 'EEE' : 'd. MMM');

function dueLabel(tone: DueTone, days: number, date: string): string {
  if (tone === 'overdue') return t.time.overdueOn(dayOf(date, days));
  // "Heute", "Morgen", "in 3 Tagen" (Intl, UI language).
  if (tone === 'today' || tone === 'soon')
    return days <= 1 ? capitalize(relativeDays(days)) : relativeDays(days);
  return formatDay(date, 'EEE, d. MMM');
}
