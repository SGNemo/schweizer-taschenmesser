import { notDeleted } from '@/core/db/repo';
import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { reminderDays, stepsOf } from './logic';
import { routineRepo } from './repo';

/**
 * Reminders of the routines that have a time (`remindAt`): one on each day the routine comes round while its turn
 * waits, never again once it is done (the turn moves on). Quiet hours and „Stumm“ apply centrally. Key:
 * `routine:<id>:<date>T<time>`; the body only says how many steps there are, never how long it waited.
 */
const source: NotificationSource = async ({ from, to }) => {
  const routines = (await routineRepo.table.filter(notDeleted).toArray()).filter((r) => r.remindAt);
  const out: DueNotification[] = [];
  const first = toDateString(new Date(from));
  const last = toDateString(new Date(to));
  for (const r of routines) {
    const time = r.remindAt!;
    for (const date of reminderDays(r, first, last)) {
      const at = toEpoch(date, time);
      if (at <= from || at > to) continue;
      const steps = stepsOf(r).length;
      out.push({
        key: `routine:${r.id}:${date}T${time}`,
        at,
        title: r.name,
        body: steps ? t.routines.stepCount(steps) : undefined,
        url: `/routines?open=${encodeURIComponent(r.id)}`,
      });
    }
  }
  return out;
};

export default source;
