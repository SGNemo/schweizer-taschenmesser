import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { cancelDeadline } from './logic';
import { contractRepo } from './repo';

/** Shows the end of each term/warranty and, where there is a notice period, its cancellation deadline. */
const source: CalendarSource = async (range) => {
  const all = (await contractRepo.table.filter(notDeleted).toArray()).filter((c) => c.endDate);
  const items: CalendarItem[] = [];
  for (const c of all) {
    const inRange = (d: string | undefined): d is string => !!d && d >= range.from && d <= range.to;
    if (inRange(c.endDate)) {
      items.push({
        id: `${c.id}:end`,
        source: 'contracts',
        kind: 'end',
        title: t.contracts.endsOn(c.name, c.kind),
        date: c.endDate,
        allDay: true,
        to: '/contracts',
      });
    }
    const deadline = cancelDeadline(c);
    if (inRange(deadline)) {
      items.push({
        id: `${c.id}:cancel`,
        source: 'contracts',
        kind: 'cancel',
        title: t.contracts.cancelBy(c.name),
        date: deadline,
        allDay: true,
        to: '/contracts',
      });
    }
  }
  return items;
};

export default source;
