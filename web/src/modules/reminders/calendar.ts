import { notDeleted } from '@/core/db/repo';
import type { CalendarSource } from '@/core/modules/types';
import { occurrencesInRange } from './logic';
import { reminderRepo } from './repo';

/** Active reminders show up on the calendar at their time of day. */
const source: CalendarSource = async (range) => {
  const reminders = (await reminderRepo.table.filter(notDeleted).toArray()).filter((r) => r.active);
  return reminders.flatMap((r) =>
    occurrencesInRange(r, range.from, range.to).map((o) => ({
      id: `${r.id}:${o.date}`,
      source: 'reminders',
      kind: 'reminder',
      title: r.title,
      date: o.date,
      time: o.time,
      allDay: false,
      to: '/reminders',
    })),
  );
};

export default source;
