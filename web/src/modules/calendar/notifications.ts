import { notDeleted } from '@/core/db/repo';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { datesInRange } from '@/core/recurrence/expand';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, toDateString, toEpoch } from '@/core/time/dates';
import { eventRepo } from './repo';
import { settings, settingsSchema } from './settings';

/** Longest lead a notification can have, in days (`notifySchema` allows 7 days). */
const MAX_LEAD_DAYS = 7;
const MINUTE_MS = 60_000;

/**
 * Events (and reminders) with `notify.enabled` fire `minutesBefore` their start, once per
 * occurrence (the first day of a multi-day event); all-day events at the module's notify time.
 * Key: `event:<id>:<date>T<time>`.
 */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.calendar', settingsSchema, settings.defaults as never);
  const events = (await eventRepo.table.filter(notDeleted).toArray()).filter(
    (e) => e.notify?.enabled,
  );
  const fromDate = toDateString(new Date(from));
  const toDate = addDaysStr(toDateString(new Date(to)), MAX_LEAD_DAYS);
  const out: DueNotification[] = [];
  for (const e of events) {
    const time = e.allDay || !e.startTime ? prefs.allDayNotifyTime : e.startTime;
    for (const date of datesInRange(e.startDate, e.recurrence, fromDate, toDate)) {
      const at = toEpoch(date, time) - e.notify!.minutesBefore * MINUTE_MS;
      if (at <= from || at > to) continue;
      out.push({
        key: `event:${e.id}:${date}T${time}`,
        at,
        title: e.title,
        body: e.note,
        url: `/calendar?view=day&date=${date}`,
      });
    }
  }
  return out;
};

export default source;
