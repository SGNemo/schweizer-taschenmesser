/**
 * The planner for automation rules (docs/decisions/automation.md, CONCEPT §7): one domain event,
 * `planner.overloaded` (`overMin`, `week`), reported by a detector from the last run's overflow – at most one
 * occurrence per ISO week. No `watch` (the planner's tables would fire on every run) and no `actions` (modules
 * give the automation `create` only, and nothing writes into the plan from a rule).
 */
import type { ModuleAutomation } from '@/core/automation/module';
import type { AutomationEvent } from '@/core/automation/types';
import { getMeta } from '@/core/db/metaKv';
import { isoWeekOf } from './overload';
import { MODULE_ID } from './repo';
import { LAST_RUN_KEY, type LastRun } from './run';

export const OVERLOADED = 'planner.overloaded';

/** Pure: the event for a stored run, or none (no overflow, or a run of another day). */
export function overloadEvent(
  last: Pick<LastRun, 'today' | 'overflowMin'> | undefined,
  today: string,
  at: number,
): AutomationEvent | undefined {
  if (!last || last.today !== today || last.overflowMin <= 0) return undefined;
  const week = isoWeekOf(today);
  return {
    type: OVERLOADED,
    moduleId: MODULE_ID,
    key: `${OVERLOADED}:${week}`,
    at,
    data: { overMin: last.overflowMin, week },
  };
}

export const automation: ModuleAutomation = {
  events: {
    [OVERLOADED]: { fields: { overMin: 'number', week: 'text' } },
  },
  detectors: [
    async ({ at, today }) => {
      const event = overloadEvent(await getMeta<LastRun>(LAST_RUN_KEY), today, at);
      return event ? [event] : [];
    },
  ],
};

export default automation;
