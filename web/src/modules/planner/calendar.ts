/**
 * The plan in the calendar (CONCEPT §5 B): **one** all-day summary chip per planned day –
 * „Plan · 2 h 25 · 5 Dinge“, kind `plan`, opening the board on that day. Never one chip per session
 * (a month cell stays calm), never a blocker for the planner itself (`days.ts` skips source `planner`),
 * skipped by the „Heute“ card and the agenda block (they list the ToDos already). Switch
 * `planner.calendarChips` (default on).
 */
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { addDays } from '@/core/plan/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { compact } from './components/capacity';
import { getPlannerSettings } from './prefs';
import { assignmentRepo, MODULE_ID } from './repo';
import type { AssignmentRow } from './schema';

export const PLAN_KIND = 'plan';
/** Days the board shows from today (`routes/PlannerPage.tsx` SPAN). */
export const BOARD_DAYS = 7;

/** The chips of the stored assignments; pure (tests). */
export function planChips(
  rows: readonly Pick<AssignmentRow, 'date' | 'itemKey' | 'minutes'>[],
): CalendarItem[] {
  const byDate = new Map<string, { minutes: number; things: Set<string> }>();
  for (const r of rows) {
    const day = byDate.get(r.date) ?? { minutes: 0, things: new Set<string>() };
    day.minutes += r.minutes;
    day.things.add(r.itemKey);
    byDate.set(r.date, day);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, d]) => ({
      id: `plan:${date}`,
      source: MODULE_ID,
      kind: PLAN_KIND,
      title: t.planner.chip.title(compact(d.minutes), d.things.size),
      date,
      allDay: true,
      to: `/planner?day=${date}`,
    }));
}

const source: CalendarSource = async (range) => {
  const settings = await getPlannerSettings();
  if (!settings.calendarChips) return [];
  // Only the board's week (today + 6): a chip opens the board on its day, later days are not on it.
  const last = addDays(today(), BOARD_DAYS - 1);
  const to = range.to < last ? range.to : last;
  if (to < range.from) return [];
  const rows = await assignmentRepo.table
    .where('date')
    .between(range.from, to, true, true)
    .filter((r) => r.deletedAt === null)
    .toArray();
  return planChips(rows);
};

export default source;
