import { daysBetween } from './dates';

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

/** How urgent a due date is relative to `today`; finished items are never "overdue". */
export function dueTone(dueDate: string | undefined, done: boolean, today: string): DueTone {
  if (!dueDate) return 'none';
  const d = daysBetween(today, dueDate);
  if (d < 0) return done ? 'later' : 'overdue';
  if (d === 0) return 'today';
  return d <= 3 ? 'soon' : 'later';
}
