import { notDeleted } from '@/core/db/repo';
import { isAcked } from '@/core/notifications/ack';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { datesInRange } from '@/core/recurrence/expand';
import { getFocusSettings } from '@/core/settings/focus';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { eventRepo } from './repo';
import { settings, settingsSchema } from './settings';

/** Longest lead a notification can have, in days (`notifySchema` allows 7 days). */
const MAX_LEAD_DAYS = 7;
const MINUTE_MS = 60_000;
/** Minutes after an unanswered reminder before the one gentle follow-up. */
export const FOLLOW_UP_MIN = 30;

/**
 * Events (and reminders) with `notify.enabled` fire `minutesBefore` their start, once per
 * occurrence (the first day of a multi-day event); all-day events at the module's notify time.
 * Key: `event:<id>:<date>T<time>`. With the focus settings "gestaffelt" there are extra, soft
 * notifications at the chosen lead times (`…:s<minutes>`); with "Nachfrage" a reminder gets one
 * follow-up (`…:f`) unless it was answered (`core/notifications/ack`).
 */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.calendar', settingsSchema, settings.defaults as never);
  const focus = await getFocusSettings();
  const events = (await eventRepo.table.filter(notDeleted).toArray()).filter(
    (e) => e.notify?.enabled,
  );
  const fromDate = toDateString(new Date(from));
  const toDate = addDaysStr(toDateString(new Date(to)), MAX_LEAD_DAYS);
  const out: DueNotification[] = [];
  const inRange = (at: number) => at > from && at <= to;
  for (const e of events) {
    const time = e.allDay || !e.startTime ? prefs.allDayNotifyTime : e.startTime;
    for (const date of datesInRange(e.startDate, e.recurrence, fromDate, toDate)) {
      const start = toEpoch(date, time);
      const at = start - e.notify!.minutesBefore * MINUTE_MS;
      const key = `event:${e.id}:${date}T${time}`;
      const url = `/calendar?view=day&date=${date}`;
      if (inRange(at)) out.push({ key, at, title: e.title, body: e.note, url });
      if (focus.staggered)
        for (const stage of focus.stages) {
          if (stage === e.notify!.minutesBefore) continue;
          const stageAt = start - stage * MINUTE_MS;
          if (inRange(stageAt))
            out.push({
              key: `${key}:s${stage}`,
              at: stageAt,
              title: e.title,
              body: t.calendar.stageBody(stage, time),
              url,
              soft: true,
            });
        }
      if (focus.followUp && e.kind === 'reminder') {
        const followAt = at + FOLLOW_UP_MIN * MINUTE_MS;
        if (inRange(followAt) && !(await isAcked(key)))
          out.push({
            key: `${key}:f`,
            at: followAt,
            title: t.calendar.followUpTitle(e.title),
            body: e.note,
            url,
            soft: true,
          });
      }
    }
  }
  return out;
};

export default source;
