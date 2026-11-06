/**
 * The plan in the calendar (CONCEPT §5 B): **one** all-day summary chip per planned day –
 * „Plan · 2 h 25 · 5 Dinge“, kind `plan`, opening the board on that day. A session the run gave a
 * time (a day with a window, package 5) is a timed block of its own instead („Steuer · Teil 1/2“,
 * `time`/`endTime`), so the hour grid shows it; what has no time stays in the day's one chip. Never a
 * blocker for the planner itself (`days.ts` skips source `planner`), never draggable (only the
 * calendar's own events are), skipped by the „Heute“ card and the agenda block (they list the ToDos
 * already). Switch `planner.calendarChips` (default on).
 */
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { getMeta } from '@/core/db/metaKv';
import { addDays } from '@/core/plan/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { compact } from './components/capacity';
import { getPlannerSettings } from './prefs';
import { assignmentRepo, MODULE_ID } from './repo';
import { LAST_RUN_KEY, type LastRun } from './run';
import type { AssignmentRow } from './schema';

export const PLAN_KIND = 'plan';
/** Days the board shows from today (`routes/PlannerPage.tsx` SPAN). */
export const BOARD_DAYS = 7;

type ChipRow = Pick<AssignmentRow, 'date' | 'itemKey' | 'minutes'> &
  Partial<Pick<AssignmentRow, 'k' | 'of' | 'from' | 'to'>>;

/**
 * The chips of the stored assignments; pure (tests). Timed sessions → one block each (title from
 * `titles`, else the plain „Im Plan“); the rest of a day → its one summary chip.
 */
export function planChips(
  rows: readonly ChipRow[],
  titles: Record<string, string> = {},
): CalendarItem[] {
  const byDate = new Map<string, { minutes: number; things: Set<string> }>();
  const blocks: CalendarItem[] = [];
  for (const r of rows) {
    if (r.from && r.to) {
      const title = titles[r.itemKey] ?? t.planner.chip.untitled;
      const part = r.of && r.of > 1 ? ` · ${t.planner.row.part((r.k ?? 0) + 1, r.of)}` : '';
      blocks.push({
        id: `plan:${r.itemKey}#${r.k ?? 0}`,
        source: MODULE_ID,
        kind: PLAN_KIND,
        title: `${title}${part}`,
        date: r.date,
        time: r.from,
        endTime: r.to,
        allDay: false,
        to: `/planner?day=${r.date}`,
      });
      continue;
    }
    const day = byDate.get(r.date) ?? { minutes: 0, things: new Set<string>() };
    day.minutes += r.minutes;
    day.things.add(r.itemKey);
    byDate.set(r.date, day);
  }
  const chips: CalendarItem[] = [...byDate.entries()].map(([date, d]) => ({
    id: `plan:${date}`,
    source: MODULE_ID,
    kind: PLAN_KIND,
    title: t.planner.chip.title(compact(d.minutes), d.things.size),
    date,
    allDay: true,
    to: `/planner?day=${date}`,
  }));
  return [...chips, ...blocks].sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      (a.time ?? '').localeCompare(b.time ?? ''),
  );
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
  // Titles of the last run (device-local, like the board's „Warum hier?“): only needed for timed blocks.
  const titles = rows.some((r) => r.from)
    ? ((await getMeta<LastRun>(LAST_RUN_KEY))?.titles ?? {})
    : {};
  return planChips(rows, titles);
};

export default source;
