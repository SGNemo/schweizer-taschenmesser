import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { ideaRepo } from './repo';

/** The day of an occasion, until the gift has been given. */
const source: CalendarSource = async (range) => {
  const ideas = (await ideaRepo.table.filter(notDeleted).toArray()).filter(
    (i) => i.date && i.status !== 'given' && i.date >= range.from && i.date <= range.to,
  );
  return ideas.map<CalendarItem>((i) => ({
    id: i.id,
    source: 'gifts',
    kind: 'gift',
    title: t.gifts.calendarTitle(i.forWhom, i.title),
    date: i.date!,
    allDay: true,
    to: '/gifts',
  }));
};

export default source;
