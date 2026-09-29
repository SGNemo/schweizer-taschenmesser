import { formatMoney } from '@/core/money';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { cancelDeadlinesInRange, chargesInRange } from './logic';
import { subscriptionRepo } from './repo';

/** Charges and cancellation deadlines of active subscriptions. */
const source: CalendarSource = async (range) => {
  const subs = (await subscriptionRepo.active().toArray()).filter((s) => s.active);
  const items: CalendarItem[] = [];
  for (const s of subs) {
    for (const date of chargesInRange(s, range.from, range.to)) {
      items.push({
        id: `${s.id}:charge:${date}`,
        source: 'subscriptions',
        kind: 'subscription',
        title: `${s.name} · ${formatMoney(s.amountMinor)}`,
        date,
        allDay: true,
        to: '/subscriptions',
      });
    }
    for (const d of cancelDeadlinesInRange(s, range.from, range.to)) {
      items.push({
        id: `${s.id}:cancel:${d.deadline}`,
        source: 'subscriptions',
        kind: 'cancel',
        title: `Kündigungsfrist: ${s.name}`,
        date: d.deadline,
        allDay: true,
        to: '/subscriptions',
      });
    }
  }
  return items;
};

export default source;
