/**
 * „Training vom Sa – eintragen?“: a fixed block (planner hub S4, a training at 18:00) whose day has passed and that
 * was never done. The engine never sees it (a fixed block is never late, moved or waiting); today's page asks once,
 * quietly, whether to log it or let it go („Weglassen“ = `skipped` on the planner's own item row, the day it was for).
 * Only the last `PASSED_DAYS` days; never a count. Pure; never reads a clock.
 */
import type { PlannableEntry } from '@/core/modules/contributions';
import { addDays } from '@/core/plan/dates';
import { fixedOf } from './days';
import { itemKeyOf } from './repo';
import type { PlanItemRow } from './schema';

/** How far back today's page asks: a week, then the training is simply gone from the plan. */
export const PASSED_DAYS = 7;

/** The window the sources are asked for: from `PASSED_DAYS` back to yesterday. */
export const passedWindow = (today: string): { today: string; until: string } => ({
  today: addDays(today, -PASSED_DAYS),
  until: addDays(today, -1),
});

export interface PassedFixed {
  entry: PlannableEntry;
  /** The day it was planned for ('YYYY-MM-DD'). */
  date: string;
  from: string;
}

/**
 * The open trainings with a time on a day of the last week, oldest first. Done, let go for that day or outside the
 * window: none. Only `training` – the one fixed kind; a new one gets words of its own first.
 */
export function passedFixed(
  entries: readonly PlannableEntry[],
  itemRows: readonly (Pick<PlanItemRow, 'skipped'> & { id: string })[],
  today: string,
): PassedFixed[] {
  const { today: from } = passedWindow(today);
  const skipped = new Map(itemRows.map((r) => [r.id, r.skipped]));
  const out: PassedFixed[] = [];
  for (const entry of entries) {
    if (entry.done || entry.kind !== 'training') continue;
    const fixed = fixedOf(entry);
    if (!fixed || fixed.date >= today || fixed.date < from) continue;
    if (skipped.get(itemKeyOf(entry.moduleId, entry.id)) === fixed.date) continue;
    out.push({ entry, date: fixed.date, from: fixed.from });
  }
  return out.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.from.localeCompare(b.from) ||
      a.entry.id.localeCompare(b.entry.id),
  );
}
