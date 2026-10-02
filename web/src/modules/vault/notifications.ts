import { notDeleted } from '@/core/db/repo';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { cancelDeadline, endOf } from './logic';
import { documentRepo } from './repo';
import { settings, settingsSchema } from './settings';

/**
 * One reminder per entry: `remindDaysBeforeDeadline` ahead of the cancellation deadline, or
 * `remindDaysBefore` ahead of the end when there is no notice period.
 */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.vault', settingsSchema, settings.defaults as never);
  const all = (await documentRepo.table.filter(notDeleted).toArray()).filter((d) => endOf(d));
  const out: DueNotification[] = [];
  for (const d of all) {
    const deadline = cancelDeadline(d);
    const target = deadline ?? endOf(d)!;
    const days = deadline ? prefs.remindDaysBeforeDeadline : prefs.remindDaysBefore;
    const at = toEpoch(addDaysStr(target, -days), prefs.remindTime);
    if (at <= from || at > to) continue;
    out.push({
      key: `vault:${d.id}:${target}`,
      at,
      title: deadline ? t.vault.cancelBy(d.title) : t.vault.endsOn(d.title, d.category),
      body: t.vault.remindBody(target),
      url: '/vault',
    });
  }
  return out;
};

export default source;
