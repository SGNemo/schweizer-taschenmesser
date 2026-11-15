/**
 * Habits as blocks of the planner (planner hub S4, concept H1 `docs/design/plan/concepts/habits.md`): a daily goal
 * with „Zeit im Plan freihalten“ keeps its minutes free on each of its scheduled days. Nothing to plan or tick –
 * `list()` is always empty; the plan never says whether the habit was done, never counts, never names a streak.
 * The block's label is the goal's name as typed, nothing derived. Archived goals, weekly goals („3× pro Woche“: no
 * day to put them on) and rest days never block.
 */
import { notDeleted } from '@/core/db/repo';
import type { PlanBlock, PlannableSource } from '@/core/modules/types';
import { addDaysStr } from '@/core/time/dates';
import { isScheduled } from './logic';
import { entryRepo, goalRepo } from './repo';
import type { Entry, Goal } from './schema';

/** The blocks of the days `today` … `until` (pure). Id `<goalId>:<date>`, like the day's entry. */
export function goalBlocks(
  goals: readonly (Pick<
    Goal,
    'name' | 'kind' | 'target' | 'period' | 'weekdays' | 'minutes' | 'archived'
  > & {
    id: string;
  })[],
  entries: readonly Pick<Entry, 'goalId' | 'date' | 'skipped'>[],
  today: string,
  until: string,
): PlanBlock[] {
  const rest = new Set(entries.filter((e) => e.skipped).map((e) => `${e.goalId}:${e.date}`));
  const out: PlanBlock[] = [];
  for (let date = today; date <= until; date = addDaysStr(date, 1))
    for (const g of goals) {
      if (g.archived || g.period !== 'day' || !g.minutes) continue;
      if (!isScheduled(g, date) || rest.has(`${g.id}:${date}`)) continue;
      out.push({ date, id: `${g.id}:${date}`, label: g.name, min: g.minutes });
    }
  return out;
}

const source: PlannableSource = {
  // Never a thing to plan: habits are ticked on their own page only.
  list: async () => [],
  async blocks(ctx) {
    const goals = (await goalRepo.active().toArray()).filter((g) => (g.minutes ?? 0) > 0);
    if (goals.length === 0) return [];
    const entries = (
      await entryRepo.table.where('date').between(ctx.today, ctx.until, true, true).toArray()
    ).filter(notDeleted);
    return goalBlocks(goals, entries, ctx.today, ctx.until);
  },
};

export default source;
