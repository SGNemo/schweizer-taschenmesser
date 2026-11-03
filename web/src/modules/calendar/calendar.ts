import { notDeleted } from '@/core/db/repo';
import type { CalendarSource } from '@/core/modules/types';
import { categoryColor } from '@/ui';
import { calendarRepo, eventRepo, externalRepo } from './repo';
import { expandEvent } from './views';

/** Own events, expanded for recurrence and multi-day spans, plus events synced from outside. */
const source: CalendarSource = async (range) => {
  const [events, external, calendars] = await Promise.all([
    eventRepo.table.filter(notDeleted).toArray(),
    externalRepo.table.filter(notDeleted).toArray(),
    calendarRepo.table.filter(notDeleted).toArray(),
  ]);
  const byId = new Map(calendars.map((c) => [c.id, c]));
  // A paused reminder (notification off) stays out of the calendar, like the old module did.
  const own = events
    .filter((e) => e.kind !== 'reminder' || e.notify?.enabled !== false)
    // Events of a switched-off calendar stay stored, they are just not shown.
    .filter((e) => !e.calendarId || byId.get(e.calendarId)?.visible !== false)
    .flatMap((e) => {
      const cal = e.calendarId ? byId.get(e.calendarId) : undefined;
      const items = expandEvent(e.id, e, range);
      return cal ? items.map((i) => ({ ...i, color: categoryColor(cal.tone) })) : items;
    });
  const outside = external.flatMap((e) =>
    expandEvent(e.id, e, range).map((item) => ({
      ...item,
      kind: 'external',
      external: true,
      color: e.color,
      location: e.location,
      url: e.url,
    })),
  );
  return [...own, ...outside];
};

export default source;
