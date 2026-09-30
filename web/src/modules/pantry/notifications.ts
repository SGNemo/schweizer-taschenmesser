import { notDeleted } from '@/core/db/repo';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { itemRepo } from './repo';
import { settings, settingsSchema } from './settings';

/** One reminder per item, `remindDaysBefore` days ahead of its best-before date. */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.pantry', settingsSchema, settings.defaults as never);
  const items = (await itemRepo.table.filter(notDeleted).toArray()).filter(
    (i) => i.expires && i.count > 0,
  );
  const out: DueNotification[] = [];
  for (const i of items) {
    const at = toEpoch(addDaysStr(i.expires!, -prefs.remindDaysBefore), prefs.remindTime);
    if (at <= from || at > to) continue;
    out.push({
      key: `pantry:${i.id}:${i.expires}`,
      at,
      title: t.pantry.expiresNotice(i.name),
      body: t.pantry.expiresBody(i.expires!),
      url: '/pantry',
    });
  }
  return out;
};

export default source;
