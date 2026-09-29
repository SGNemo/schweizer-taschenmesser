import { notDeleted } from '@/core/db/repo';
import type { NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toDateString, toEpoch } from '@/core/time/dates';
import { birthdaysInRange, dayBefore, titleFor } from './logic';
import { birthdayRepo } from './repo';
import { settings, settingsSchema } from './settings';

const DAY_MS = 86_400_000;

const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.birthdays', settingsSchema, settings.defaults as never);
  const fromDue = addDaysStr(toDateString(new Date(from)), prefs.remindDaysBefore);
  const toDue = addDaysStr(toDateString(new Date(to + DAY_MS)), prefs.remindDaysBefore);
  const all = await birthdayRepo.table.filter(notDeleted).toArray();
  return all
    .flatMap((b) =>
      birthdaysInRange(b, fromDue, toDue).map((date) => ({
        key: `birthday:${b.id}:${date}`,
        at: toEpoch(dayBefore(date, prefs.remindDaysBefore), prefs.remindTime),
        title: titleFor(b, date),
        body: prefs.remindDaysBefore === 0 ? 'Heute' : `In ${prefs.remindDaysBefore} Tagen`,
        url: '/birthdays',
      })),
    )
    .filter((n) => n.at > from && n.at <= to);
};

export default source;
