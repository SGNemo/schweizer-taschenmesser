import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { birthdaysInRange, birthdayTitle } from './logic';
import { giftRepo, personRepo } from './repo';

/** Birthdays repeat every year; the day of a gift occasion shows until the gift has been given. */
const source: CalendarSource = async (range) => {
  const [people, gifts] = await Promise.all([
    personRepo.table.filter(notDeleted).toArray(),
    giftRepo.table.filter(notDeleted).toArray(),
  ]);
  const items: CalendarItem[] = people.flatMap((p) =>
    p.birthday
      ? birthdaysInRange(p.birthday, range.from, range.to).map((date) => ({
          id: `${p.id}:${date}`,
          source: 'people',
          kind: 'birthday',
          title: birthdayTitle(p.name, p.birthday!, date),
          date,
          allDay: true,
          to: `/people?person=${p.id}`,
        }))
      : [],
  );
  const names = new Map(people.map((p) => [p.id, p.name]));
  for (const g of gifts) {
    if (!g.date || g.status === 'given' || g.date < range.from || g.date > range.to) continue;
    items.push({
      id: g.id,
      source: 'people',
      kind: 'gift',
      title: t.people.calendarGift(names.get(g.personId) ?? '', g.title),
      date: g.date,
      allDay: true,
      to: `/people?person=${g.personId}`,
    });
  }
  return items;
};

export default source;
