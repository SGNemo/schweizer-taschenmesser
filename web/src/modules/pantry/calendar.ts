import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { itemRepo } from './repo';

/** Best-before dates of items that are still in stock. */
const source: CalendarSource = async (range) => {
  const items = (await itemRepo.table.filter(notDeleted).toArray()).filter(
    (i) => i.expires && i.count > 0 && i.expires >= range.from && i.expires <= range.to,
  );
  return items.map<CalendarItem>((i) => ({
    id: i.id,
    source: 'pantry',
    kind: 'expiry',
    title: t.pantry.expiresNotice(i.name),
    date: i.expires!,
    allDay: true,
    to: '/pantry',
  }));
};

export default source;
