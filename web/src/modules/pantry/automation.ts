import type { AutomationEvent } from '@/core/automation/types';
import type { ModuleAutomation } from '@/core/automation/module';
import { daysBetween } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { itemRepo } from './repo';
import type { PantryItem } from './schema';

const LOOK_AHEAD_DAYS = 14;

const belowMinimum = (i: PantryItem & { id: string }, at: number): AutomationEvent => ({
  type: 'pantry.belowMinimum',
  moduleId: 'pantry',
  // a new occurrence whenever the count changes while it is below the minimum
  key: `pantry.belowMinimum:${i.id}:${i.count}`,
  at,
  data: {
    id: i.id,
    name: i.name,
    count: i.count,
    minCount: i.minCount,
    unit: i.unit ?? '',
    place: i.place,
  },
  title: i.name,
});

export const automation: ModuleAutomation = {
  watch: {
    item: {
      fields: {
        name: 'text',
        count: 'number',
        minCount: 'number',
        unit: 'text',
        place: 'text',
        expires: 'date',
      },
    },
  },
  events: {
    'pantry.belowMinimum': {
      fields: { name: 'text', count: 'number', minCount: 'number', unit: 'text', place: 'text' },
    },
    'pantry.expiringSoon': {
      fields: { name: 'text', expires: 'date', daysLeft: 'number', count: 'number' },
    },
  },
  // Right when the count drops under the minimum; the detector below catches what was missed.
  derive: (signal, base) => {
    const d = signal.data;
    if (signal.table !== 'pantry_item' || signal.kind !== 'updated' || !d) return [];
    const min = d.minCount;
    const before = signal.before?.count;
    if (typeof min !== 'number' || typeof d.count !== 'number' || typeof before !== 'number')
      return [];
    if (d.count > min || before <= min) return [];
    return [belowMinimum({ ...(d as unknown as PantryItem), id: signal.id }, base.at)];
  },
  detectors: [
    async ({ today }) => {
      const out: AutomationEvent[] = [];
      for (const i of await itemRepo.active().toArray()) {
        if (i.minCount !== undefined && i.count <= i.minCount) out.push(belowMinimum(i, now()));
        if (i.expires && i.count > 0) {
          const daysLeft = daysBetween(today, i.expires);
          if (daysLeft >= 0 && daysLeft <= LOOK_AHEAD_DAYS)
            out.push({
              type: 'pantry.expiringSoon',
              moduleId: 'pantry',
              key: `pantry.expiringSoon:${i.id}:${i.expires}`,
              at: now(),
              data: { id: i.id, name: i.name, expires: i.expires, daysLeft, count: i.count },
              title: i.name,
            });
        }
      }
      return out;
    },
  ],
  // `create` adds an item, no action changes a stock count.
  actions: ['create'],
};

export default automation;
