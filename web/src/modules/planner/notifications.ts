/**
 * „Rest verteilen?“ (use case „Wochenende retten“, F3): one soft notification at 20:00 while the planner still holds
 * something for that day that the evening's ops would move. Off by default (`focus.restReminder`, Settings →
 * „Ruhige Erinnerungen“); once a day (key `planner:rest:<date>`), never repeated (no `…:r` series), no count.
 * When 20:00 falls into the quiet hours or a running „Stumm“ pause it is left out, never moved to the morning (a
 * morning „Rest verteilen?“ would be noise). Device-local (`local: true`). Nothing moves: the notification only opens the preview.
 */
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getMute } from '@/core/notifications/mute';
import { inQuiet } from '@/core/notifications/policy';
import { getFocusSettings, type FocusSettings } from '@/core/settings/focus';
import { eachDay, toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { assignmentRepo } from './repo';
import { REST_PATH } from './rest';

/** The hour of „Rest verteilen?“: before the default quiet hours (22–07). */
export const REST_REMINDER_TIME = '20:00';

/**
 * The notifications in (from, to]: one per day at 20:00 with `open(date)` true. Pure (the tests drive it).
 */
export function restNotices(
  range: { from: number; to: number },
  focus: Pick<FocusSettings, 'restReminder' | 'quietHours' | 'quietFrom' | 'quietTo'>,
  open: (date: string) => boolean,
  muted: (at: number) => boolean = (at) => getMute(at) !== undefined,
): DueNotification[] {
  if (!focus.restReminder) return [];
  const out: DueNotification[] = [];
  for (const date of eachDay(
    toDateString(new Date(range.from)),
    toDateString(new Date(range.to)),
  )) {
    const at = toEpoch(date, REST_REMINDER_TIME);
    if (at <= range.from || at > range.to) continue;
    if (focus.quietHours && inQuiet(at, { from: focus.quietFrom, to: focus.quietTo })) continue;
    // A running „Stumm“ pause would move a soft notice to its end (late at night or the morning): left out instead.
    if (muted(at)) continue;
    if (!open(date)) continue;
    out.push({
      key: `planner:rest:${date}`,
      at,
      title: t.planner.rest.notifyTitle,
      body: t.planner.rest.notifyBody,
      url: REST_PATH,
      soft: true,
      // An extra about the person's own day: it stays on this device (no Web Push upload, not even its key).
      local: true,
    });
  }
  return out;
}

const source: NotificationSource = async (range) => {
  const focus = await getFocusSettings();
  if (!focus.restReminder) return [];
  const rows = await assignmentRepo.active().toArray();
  // A thing that is „fest“ on the day stays there: it alone is no reason to ask.
  return restNotices(range, focus, (date) => rows.some((r) => r.date === date && !r.locked));
};

export default source;
