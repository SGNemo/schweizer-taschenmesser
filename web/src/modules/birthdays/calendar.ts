import { notDeleted } from '@/core/db/repo';
import type { CalendarSource } from '@/core/modules/types';
import { birthdaysInRange, titleFor } from './logic';
import { birthdayRepo } from './repo';

/** Birthdays recur every year as all-day entries. */
const source: CalendarSource = async (range) => {
  const all = await birthdayRepo.table.filter(notDeleted).toArray();
  return all.flatMap((b) =>
    birthdaysInRange(b, range.from, range.to).map((date) => ({
      id: `${b.id}:${date}`,
      source: 'birthdays',
      kind: 'birthday',
      title: titleFor(b, date),
      date,
      allDay: true,
      to: '/birthdays',
    })),
  );
};

export default source;
