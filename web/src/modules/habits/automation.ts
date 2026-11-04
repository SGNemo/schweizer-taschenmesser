import type { AutomationEvent } from '@/core/automation/types';
import type { ModuleAutomation } from '@/core/automation/module';
import { now } from '@/core/time/now';
import { isScheduled } from './logic';
import { entryId } from './repo';
import { entryRepo, goalRepo } from './repo';

/**
 * "Not done yet today" for daily goals that are scheduled today. Reports state only, never counts
 * a streak and never changes an entry: the rule decides how gently to say it.
 */
export const automation: ModuleAutomation = {
  events: {
    'habits.goal.open': {
      fields: { name: 'text', date: 'date', target: 'number', count: 'number' },
    },
  },
  detectors: [
    async ({ today }) => {
      const out: AutomationEvent[] = [];
      for (const g of await goalRepo.active().toArray()) {
        if (g.archived || g.period !== 'day' || !isScheduled(g, today)) continue;
        const entry = await entryRepo.get(entryId(g.id, today));
        if (entry?.skipped || (entry?.count ?? 0) >= g.target) continue;
        out.push({
          type: 'habits.goal.open',
          moduleId: 'habits',
          key: `habits.goal.open:${g.id}:${today}`,
          at: now(),
          data: { id: g.id, name: g.name, date: today, target: g.target, count: entry?.count ?? 0 },
          title: g.name,
        });
      }
      return out;
    },
  ],
};

export default automation;
