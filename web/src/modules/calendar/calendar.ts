import { notDeleted } from '@/core/db/repo';
import type { CalendarSource } from '@/core/modules/types';
import { eventRepo, externalRepo } from './repo';
import { expandEvent } from './views';

/** Own events, expanded for recurrence and multi-day spans, plus events synced from outside. */
const source: CalendarSource = async (range) => {
  const [events, external] = await Promise.all([
    eventRepo.table.filter(notDeleted).toArray(),
    externalRepo.table.filter(notDeleted).toArray(),
  ]);
  // A paused reminder (notification off) stays out of the calendar, like the old module did.
  const own = events
    .filter((e) => e.kind !== 'reminder' || e.notify?.enabled !== false)
    .flatMap((e) => expandEvent(e.id, e, range));
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
