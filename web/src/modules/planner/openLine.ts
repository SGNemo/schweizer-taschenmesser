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

/**
 * The accessible name of the tab „Noch offen“ while it holds something: „Noch offen: Dinge von Mo 16., Di 17.“ – up to
 * three days with their date (a bare „Mo“ could be last week's or the coming one); more: „Noch offen: Dinge seit Do 12.“
 */
export function openTabName(rows: readonly { date: string }[]): string {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const named = (d: string) => `${dayName(d)} ${formatDay(d, 'd.')}`;
  return dates.length <= 3
    ? t.planner.tabs.openFrom(dates.map(named).join(', '))
    : t.planner.tabs.openSince(named(dates[0]!));
}
