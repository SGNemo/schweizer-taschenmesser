import { currencyOf, formatMoney } from '@/core/money';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { today } from '@/core/time/dates';
import { tDeadline } from '@/strings.deadline';
import { cancelDeadlinesInRange, chargesInRange, missedDeadline } from './logic';
import { subscriptionRepo } from './repo';
import { t } from '@/strings';

/** Charges and cancellation deadlines of active subscriptions. */
const source: CalendarSource = async (range) => {
  const subs = (await subscriptionRepo.active().toArray()).filter((s) => s.active);
  const items: CalendarItem[] = [];
  const day = today();
  for (const s of subs) {
    for (const date of chargesInRange(s, range.from, range.to)) {
      items.push({
        id: `${s.id}:charge:${date}`,
        source: 'subscriptions',
        kind: 'subscription',
        title: `${s.name} · ${formatMoney(s.amountMinor, currencyOf(s))}`,
        date,
        allDay: true,
        to: '/subscriptions',
      });
    }
    const missed = missedDeadline(s, day);
    for (const d of cancelDeadlinesInRange(s, range.from, range.to)) {
      const passed = missed?.deadline === d.deadline;
      items.push({
        id: `${s.id}:cancel:${d.deadline}`,
        source: 'subscriptions',
        kind: 'cancel',
        title: passed
          ? tDeadline.get().missedCalendar(s.name)
          : t.subscriptions.cancelCalendar(s.name),
        date: d.deadline,
        allDay: true,
        to: '/subscriptions',
      });
    }
  }
  return items;
};

export default source;
