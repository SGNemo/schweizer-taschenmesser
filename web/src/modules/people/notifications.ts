import { notDeleted } from '@/core/db/repo';
import type { NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { birthdaysInRange, birthdayTitle, dayBefore } from './logic';
import { personRepo } from './repo';
import { settings, settingsSchema } from './settings';

const DAY_MS = 86_400_000;

/** Birthday reminders, `remindDaysBefore` days ahead (0 = on the day). Keys keep the old `birthday:` form. */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.people', settingsSchema, settings.defaults as never);
  const all = (await personRepo.table.filter(notDeleted).toArray()).filter((p) => p.birthday);
  return all
    .flatMap((p) => {
      // A person's own lead time wins over the module setting.
      const lead = p.remindDaysBefore ?? prefs.remindDaysBefore;
      const fromDue = addDaysStr(toDateString(new Date(from)), lead);
      const toDue = addDaysStr(toDateString(new Date(to + DAY_MS)), lead);
      return birthdaysInRange(p.birthday!, fromDue, toDue).map((date) => ({
        key: `birthday:${p.id}:${date}`,
        at: toEpoch(dayBefore(date, lead), prefs.remindTime),
        title: birthdayTitle(p.name, p.birthday!, date),
        body: lead === 0 ? t.people.today : t.people.inDays(lead),
        url: `/people?person=${p.id}`,
      }));
    })
    .filter((n) => n.at > from && n.at <= to);
};

export default source;
