import { notDeleted } from '@/core/db/repo';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { cancelDeadline } from './logic';
import { contractRepo } from './repo';
import { settings, settingsSchema } from './settings';

/** One reminder `remindDaysBefore` days ahead of the cancellation deadline (or the end, without notice period). */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.contracts', settingsSchema, settings.defaults as never);
  const all = (await contractRepo.table.filter(notDeleted).toArray()).filter((c) => c.endDate);
  const out: DueNotification[] = [];
  for (const c of all) {
    const deadline = cancelDeadline(c);
    const target = deadline ?? c.endDate!;
    const at = toEpoch(addDaysStr(target, -prefs.remindDaysBefore), prefs.remindTime);
    if (at <= from || at > to) continue;
    out.push({
      key: `contract:${c.id}:${target}`,
      at,
      title: deadline ? t.contracts.cancelBy(c.name) : t.contracts.endsOn(c.name, c.kind),
      body: t.contracts.remindBody(target),
      url: '/contracts',
    });
  }
  return out;
};

export default source;
