import type { AutomationEvent } from '@/core/automation/types';
import type { ModuleAutomation } from '@/core/automation/module';
import { daysBetween } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { changePercent, nextCharge, recentIncrease } from './logic';
import { subscriptionRepo } from './repo';
import type { Subscription } from './schema';

type Change = NonNullable<Subscription['priceHistory']>[number];

const priceChanged = (
  id: string,
  name: string,
  c: Change,
  currency: string,
  at: number,
): AutomationEvent => ({
  type: 'subscription.priceChanged',
  moduleId: 'subscriptions',
  key: `subscription.priceChanged:${id}:${c.date}:${c.toMinor}`,
  at,
  data: {
    id,
    name,
    fromMinor: c.fromMinor,
    toMinor: c.toMinor,
    percent: changePercent(c),
    date: c.date,
    currency,
  },
  title: name,
});

const PRICE_FIELDS = {
  name: 'text',
  fromMinor: 'number',
  toMinor: 'number',
  percent: 'number',
  date: 'date',
} as const;

/** Only reads and reports: no action writes to subscriptions. */
export const automation: ModuleAutomation = {
  events: {
    'subscription.priceChanged': { fields: PRICE_FIELDS },
    'subscription.renewsSoon': {
      fields: { name: 'text', amountMinor: 'number', nextDate: 'date', daysLeft: 'number' },
    },
  },
  derive: (signal, base) => {
    if (signal.table !== 'subscriptions_subscription' || signal.kind !== 'updated') return [];
    const history = signal.data?.priceHistory as Change[] | undefined;
    const previous = (signal.before?.priceHistory as Change[] | undefined) ?? [];
    const last = history?.at(-1);
    if (!history || !last || history.length <= previous.length) return [];
    return [
      priceChanged(
        signal.id,
        String(signal.data?.name ?? ''),
        last,
        String(signal.data?.currency ?? ''),
        base.at,
      ),
    ];
  },
  detectors: [
    async ({ today }) => {
      const out: AutomationEvent[] = [];
      for (const s of await subscriptionRepo.active().toArray()) {
        if (!s.active) continue;
        const rise = recentIncrease(s.priceHistory ?? [], today, 7);
        if (rise) out.push(priceChanged(s.id, s.name, rise, s.currency ?? '', now()));
        const next = nextCharge(s, today);
        const daysLeft = next ? daysBetween(today, next) : undefined;
        if (next && daysLeft !== undefined && daysLeft <= 14)
          out.push({
            type: 'subscription.renewsSoon',
            moduleId: 'subscriptions',
            key: `subscription.renewsSoon:${s.id}:${next}`,
            at: now(),
            data: { id: s.id, name: s.name, amountMinor: s.amountMinor, nextDate: next, daysLeft },
            title: s.name,
          });
      }
      return out;
    },
  ],
};

export default automation;
