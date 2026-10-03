import type { DueNotification, NotificationSource } from '@/core/modules/types';
import { getFocusSettings } from '@/core/settings/focus';
import { eachDay, toDateString, toEpoch } from '@/core/time/dates';
import { t } from '@/strings';
import { taskRepo } from './repo';

/**
 * One calm notification per morning that lists today's ToDos (due or planned for the day), instead
 * of one per task. Switch and time: Settings → Benachrichtigungen → "Ruhige Erinnerungen".
 * Key: `todos:digest:<date>`; soft, so the quiet hours move it.
 */
const source: NotificationSource = async ({ from, to }) => {
  const focus = await getFocusSettings();
  if (!focus.todoDigest) return [];
  const open = (await taskRepo.active().toArray()).filter(
    (x) => !x.done && !x.someday && !x.parentId,
  );
  const out: DueNotification[] = [];
  for (const date of eachDay(toDateString(new Date(from)), toDateString(new Date(to)))) {
    const at = toEpoch(date, focus.todoDigestTime);
    if (at <= from || at > to) continue;
    const today = open
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
