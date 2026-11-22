/** The line on today's sheet while something of a passed day is open (planner rethink, package 3). Pure. */
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';

/**
 * „Von Mo, Di ist noch etwas offen.“ – up to three days by their short name; more: „Seit Do, 12. ist noch etwas offen.“
 * (the oldest day; CONCEPT-COPY). Never a count.
 */
export function openLineText(rows: readonly { date: string }[]): string {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  if (dates.length <= 3) return t.planner.open.line(dates.map(dayName).join(', '));
  const first = dates[0]!;
  return t.planner.open.lineSince(`${dayName(first)}, ${formatDay(first, 'd.')}`);
}
