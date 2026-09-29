import { notDeleted } from '@/core/db/repo';
import type { NotificationSource } from '@/core/modules/types';
import { toDateString } from '@/core/time/dates';
import { occurrencesInRange } from './logic';
import { reminderRepo } from './repo';

/** Fires at the reminder's local time; the key is unique per reminder and occurrence. */
const source: NotificationSource = async ({ from, to }) => {
  const fromDate = toDateString(new Date(from));
  const toDate = toDateString(new Date(to));
  const reminders = (await reminderRepo.table.filter(notDeleted).toArray()).filter((r) => r.active);
  return reminders.flatMap((r) =>
    occurrencesInRange(r, fromDate, toDate)
      .filter((o) => o.at > from && o.at <= to)
      .map((o) => ({
        key: `reminder:${r.id}:${o.date}T${o.time}`,
        at: o.at,
        title: r.title,
        body: r.note,
        url: '/reminders',
      })),
  );
};

export default source;
