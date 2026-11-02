/**
 * The new-mail notification: one per poll that found something, folded by the calm policy like every
 * automatic extra (`soft`: quiet hours move it, the per-hour limit folds it). Text is a count; sender
 * names only when the user switched that on. `local`: never uploaded for Web Push. Fires while the app runs.
 */
import { listMailAccounts } from '@/core/mail/accounts';
import { summarize } from '@/core/mail/notify';
import { loadNotifyState } from '@/core/mail/state';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { loadThreads } from './cache';
import { personName } from './format';
import { settings, type MailSettings } from './settings';

const source: NotificationSource = async (range) => {
  const prefs = (await getSettings(
    'module.mail',
    settings.schema,
    settings.defaults,
  )) as MailSettings;
  if (!prefs.notify) return [];
  const out: DueNotification[] = [];
  for (const account of await listMailAccounts()) {
    if (!account.features?.includes('mail')) continue;
    const state = await loadNotifyState(account.key);
    const batches = state.batches.filter((b) => b.at > range.from && b.at <= range.to);
    if (batches.length === 0) continue;
    const cached = await loadThreads(account.key);
    const unread = new Set(cached.filter((c) => c.unread).map((c) => c.id));
    const names = prefs.notifyNames
      ? new Map(cached.map((c) => [c.id, personName(c.from)]))
      : undefined;
    for (const batch of batches) {
      const text = summarize(
        batch,
        unread,
        {
          title: t.mail.notify.title,
          senders: t.mail.notify.senders,
        },
        names,
      );
      if (!text) continue; // read elsewhere in the meantime: nothing to say
      out.push({
        key: `mail-new:${account.key}:${batch.at}`,
        at: batch.at,
        title: text.title,
        body: text.body,
        url: '/mail',
        soft: true,
        local: true,
      });
    }
  }
  return out;
};

export default source;
