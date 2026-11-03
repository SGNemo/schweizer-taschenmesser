import { notDeleted } from '@/core/db/repo';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr, eachDay, toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { byDate, dayState, weekDone } from './logic';
import { entryRepo, goalRepo } from './repo';
import type { Goal } from './schema';
import { settings, settingsSchema } from './settings';

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');

/** The clock times of a reminder on one day: one time, or from/to every `everyMin` (both ends included). */
export function reminderTimes(reminder: NonNullable<Goal['reminder']>): string[] {
  if (reminder.kind === 'time') return [reminder.time];
  const out: string[] = [];
  for (let m = toMin(reminder.from); m <= toMin(reminder.to); m += reminder.everyMin)
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

/**
 * Reminders of the habits. A goal with a reminder notifies on the days it is planned, **unless the
 * day is already done or a rest day** (a weekly goal: unless the week is met). The window kind
 * keeps asking every `everyMin` minutes only until the goal is reached – that is the "Trink was"
 * reminder: it stops by itself. Quiet hours and "Stumm" apply centrally. Key:
 * `habit:<goalId>:<date>T<time>`; the body is the day's progress, never a reproach.
 */
const source: NotificationSource = async ({ from, to }) => {
  const prefs = await getSettings('module.habits', settingsSchema, settings.defaults as never);
  if (!prefs.remindersEnabled) return [];
  const goals = (await goalRepo.table.filter(notDeleted).toArray()).filter(
    (g) => g.reminder && !g.archived,
  );
  if (goals.length === 0) return [];
  const entries = await entryRepo.table.filter(notDeleted).toArray();
  const out: DueNotification[] = [];
  const first = toDateString(new Date(from));
  const last = toDateString(new Date(to));
  for (const goal of goals) {
    const map = byDate(entries, goal.id);
    for (const date of eachDay(first, addDaysStr(last, 0))) {
      const entry = map.get(date);
      const state = dayState(goal, entry, date);
      if (state === 'done' || state === 'rest' || state === 'off') continue;
      if (goal.period === 'week' && weekDone(goal, map, date).done >= (goal.weeklyTimes ?? 3))
        continue;
      for (const time of reminderTimes(goal.reminder!)) {
        const at = toEpoch(date, time);
        if (at <= from || at > to) continue;
        out.push({
          key: `habit:${goal.id}:${date}T${time}`,
          at,
          title: goal.name,
          body:
            goal.kind === 'count'
              ? t.habits.notify.body(entry?.count ?? 0, goal.target, goal.unit)
              : undefined,
          url: '/habits',
        });
      }
    }
  }
  return out;
};

export default source;
