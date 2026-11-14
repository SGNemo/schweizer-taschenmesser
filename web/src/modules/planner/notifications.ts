/**
 * „Rest verteilen?“ (use case „Wochenende retten“, F3): one soft notification at 20:00 while the planner still holds
 * something for that day that the evening's ops would move. Off by default (`focus.restReminder`, Settings →
 * „Ruhige Erinnerungen“); once a day (key `planner:rest:<date>`), never repeated (no `…:r` series), no count.
 * When 20:00 falls into the quiet hours it is left out, never moved to the morning (a morning „Rest verteilen?“
 * would be noise). Nothing moves: the notification only opens the preview.
 */
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { inQuiet } from '@/core/notifications/policy';
import { getFocusSettings, type FocusSettings } from '@/core/settings/focus';
import { eachDay, toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { assignmentRepo, itemRepo } from './repo';
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
    if (!open(date)) continue;
    out.push({
      key: `planner:rest:${date}`,
      at,
      title: t.planner.rest.notifyTitle,
      body: t.planner.rest.notifyBody,
      url: REST_PATH,
      soft: true,
    });
  }
  return out;
}

const source: NotificationSource = async (range) => {
  const focus = await getFocusSettings();
  if (!focus.restReminder) return [];
  const [rows, items] = await Promise.all([
    assignmentRepo.active().toArray(),
    itemRepo.active().toArray(),
  ]);
  const pinned = new Map(items.filter((i) => i.pinned).map((i) => [i.id, i.pinned!]));
  // A thing nailed to the day stays there: it alone is no reason to ask.
  return restNotices(range, focus, (date) =>
    rows.some((r) => r.date === date && pinned.get(r.itemKey) !== date),
  );
};

export default source;
