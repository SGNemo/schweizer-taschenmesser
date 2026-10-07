import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { cancelDeadline, endOf } from './logic';
import { documentRepo } from './repo';

/** The end of each document/term/warranty and, where there is a notice period, its cancellation deadline. */
const source: CalendarSource = async (range) => {
  const all = (await documentRepo.table.filter(notDeleted).toArray()).filter((d) => endOf(d));
  const inRange = (d: string | undefined): d is string => !!d && d >= range.from && d <= range.to;
  const items: CalendarItem[] = [];
  for (const d of all) {
    const end = endOf(d);
    if (inRange(end)) {
      items.push({
        id: `${d.id}:end`,
        source: 'vault',
        kind: 'end',
        title: t.vault.endsOn(d.title, d.category),
        date: end,
        allDay: true,
        to: '/vault',
      });
    }
    const deadline = cancelDeadline(d);
    if (inRange(deadline)) {
      items.push({
        id: `${d.id}:cancel`,
        source: 'vault',
        kind: 'cancel',
        title: t.vault.cancelBy(d.title),
        date: deadline,
        allDay: true,
        to: '/vault',
      });
    }
  }
  return items;
};

export default source;
