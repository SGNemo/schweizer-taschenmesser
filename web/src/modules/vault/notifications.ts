import { notDeleted } from '@/core/db/repo';
import type { NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { documentRepo } from './repo';
import { settings, settingsSchema } from './settings';

const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.vault', settingsSchema, settings.defaults as never);
  const docs = (await documentRepo.table.filter(notDeleted).toArray()).filter((d) => d.expiresOn);
  return docs
    .map((d) => ({
      key: `vault:${d.id}:${d.expiresOn}`,
      at: toEpoch(addDaysStr(d.expiresOn!, -prefs.remindDaysBefore), prefs.remindTime),
      title: t.vault.expiresTitle(d.title),
      body: t.vault.remindBody(d.expiresOn!),
      url: '/vault',
    }))
    .filter((n) => n.at > from && n.at <= to);
};

export default source;
