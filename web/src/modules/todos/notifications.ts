import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getFocusSettings } from '@/core/settings/focus';
import { eachDay, toDateString, toEpoch } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { taskRepo } from './repo';
import type { Task } from './schema';

/** „Erinnern: 1 Std vorher“: how long before the deadline's hour it notifies. */
export const DUE_REMIND_LEAD_MS = 60 * 60_000;

/**
 * The opt-in deadline reminder of one task (package 5b): one notification an hour before `dueDate` + `dueTime`,
 * only while `dueRemind` is on and the task is open. The key carries the deadline itself, so a moved deadline
 * is a new reminder and the old one is never sent; done or deleted tasks are not listed at all. Set by the user,
 * so not `soft` (the quiet hours do not move it); „Stumm“ and the hourly limit apply as to every reminder.
 */
export function dueReminder(
  task: Pick<Task, 'title' | 'dueDate' | 'dueTime' | 'dueRemind' | 'done'> & { id: string },
): DueNotification | undefined {
  if (!task.dueRemind || task.done || !task.dueDate || !task.dueTime) return undefined;
  return {
    key: `todos:due:${task.id}:${task.dueDate}T${task.dueTime}`,
    at: toEpoch(task.dueDate, task.dueTime) - DUE_REMIND_LEAD_MS,
    title: t.todos.dueRemindTitle(task.dueTime, task.title),
    body: t.todos.dueRemindBody,
    url: `/todos?open=${task.id}`,
  };
}

/**
 * Two kinds, both calm. One notification per morning that lists today's ToDos (due or planned for the day),
 * instead of one per task (switch and time: Settings → Benachrichtigungen → "Ruhige Erinnerungen"; key
 * `todos:digest:<date>`; soft, so the quiet hours move it). And the deadline reminders the user switched on per
 * task (`dueReminder`), independent of the digest switch.
 */
const source: NotificationSource = async ({ from, to }) => {
  const focus = await getFocusSettings();
  const open = (await taskRepo.active().toArray()).filter((x) => !x.done);
  const out: DueNotification[] = [];
  // Asked for per task, so also for a subtask or an „Irgendwann“ one: what was switched on is sent.
  // A catch-up after the app was closed never says „in einer Stunde“ about a deadline that has passed.
  const at = now();
  for (const task of open) {
    const n = dueReminder(task);
    if (n && n.at > from && n.at <= to && n.at + DUE_REMIND_LEAD_MS > at) out.push(n);
  }
  if (!focus.todoDigest) return out;
  const top = open.filter((x) => !x.someday && !x.parentId);
  for (const date of eachDay(toDateString(new Date(from)), toDateString(new Date(to)))) {
    const at = toEpoch(date, focus.todoDigestTime);
    if (at <= from || at > to) continue;
    const today = top
      .filter((x) => x.dueDate === date || x.plannedFor === date)
      .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
    if (today.length === 0) continue;
    out.push({
      key: `todos:digest:${date}`,
      at,
      title: t.todos.digestTitle(today.length),
      body:
        today
          .slice(0, 3)
          .map((x) => x.title)
          .join(' · ') + (today.length > 3 ? ' …' : ''),
      url: '/',
      soft: true,
    });
  }
  return out;
};

export default source;
