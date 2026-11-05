import { currencyOf, formatMoney } from '@/core/money';
import type { NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, formatDay, toDateString, toEpoch } from '@/core/time/dates';
import type { Stored } from '@/core/db/types';
import { cancelDeadlinesInRange } from './logic';
import type { Subscription } from './schema';
import { subscriptionRepo } from './repo';
import { settings, settingsSchema } from './settings';
import { t } from '@/strings';

const DAY_MS = 86_400_000;

/** Reminds shortly before the cancellation deadline of a subscription runs out. */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings(
    'module.subscriptions',
    settingsSchema,
    settings.defaults as never,
  );
  const before = prefs.cancelRemindDaysBefore;
  // The reminder lies `before` days ahead of the deadline, so search deadlines that far ahead.
  const fromDate = addDaysStr(toDateString(new Date(from)), before);
  const toDate = addDaysStr(toDateString(new Date(to + DAY_MS)), before);
  const subs = (await subscriptionRepo.active().toArray()).filter((s) => s.active);
  // Cancelled "zum" a date (`until`): there is no deadline left to remind of.
  const running = subs.filter((s) => !s.recurrence.until);
  return running
    .flatMap((s) =>
      cancelDeadlinesInRange(s, fromDate, toDate).map((d) => ({
        key: `subscription-cancel:${s.id}:${d.deadline}`,
        at: toEpoch(addDaysStr(d.deadline, -before), prefs.remindTime),
        title: t.subscriptions.cancelTitle(s.name),
        body: t.subscriptions.cancelBody(
          formatDay(d.deadline, 'd. MMM yyyy'),
          formatMoney(s.amountMinor, currencyOf(s)),
          formatDay(d.charge, 'd. MMM yyyy'),
        ),
        url: '/subscriptions',
      })),
    )
    .concat(trialReminders(subs, prefs, from, to))
    .filter((n) => n.at > from && n.at <= to);
};

/** One reminder per trial, `trialRemindDaysBefore` days before it ends (0 = on the last day). */
function trialReminders(
  subs: Stored<Subscription>[],
  prefs: { trialRemindDaysBefore: number; remindTime: string },
  from: number,
  to: number,
) {
  return subs
    .filter((s) => s.trialEndsOn)
    .map((s) => ({
      key: `subscription-trial:${s.id}:${s.trialEndsOn}`,
      at: toEpoch(addDaysStr(s.trialEndsOn!, -prefs.trialRemindDaysBefore), prefs.remindTime),
      title: t.subscriptions.ext.trial.reminderTitle(s.name),
      body: t.subscriptions.ext.trial.reminderBody(
        formatDay(s.trialEndsOn!, 'd. MMM yyyy'),
        formatMoney(s.amountMinor, currencyOf(s)),
      ),
      url: '/subscriptions',
    }))
    .filter((n) => n.at > from && n.at <= to);
}

export default source;
