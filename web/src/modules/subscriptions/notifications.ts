import { formatMoney } from '@/core/money';
import type { NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, formatDay, toDateString, toEpoch } from '@/core/time/dates';
import { cancelDeadlinesInRange } from './logic';
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
  return subs
    .flatMap((s) =>
      cancelDeadlinesInRange(s, fromDate, toDate).map((d) => ({
        key: `subscription-cancel:${s.id}:${d.deadline}`,
        at: toEpoch(addDaysStr(d.deadline, -before), prefs.remindTime),
        title: t.subscriptions.cancelTitle(s.name),
        body: t.subscriptions.cancelBody(
          formatDay(d.deadline, 'd. MMM yyyy'),
          formatMoney(s.amountMinor),
          formatDay(d.charge, 'd. MMM yyyy'),
        ),
        url: '/subscriptions',
      })),
    )
    .filter((n) => n.at > from && n.at <= to);
};

export default source;
