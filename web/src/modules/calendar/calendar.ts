import { notDeleted } from '@/core/db/repo';
import type { CalendarSource } from '@/core/modules/types';
import { eventRepo } from './repo';
import { expandEvent } from './views';

/** Own events, expanded for recurrence and multi-day spans. */
const source: CalendarSource = async (range) => {
  const events = await eventRepo.table.filter(notDeleted).toArray();
  return events.flatMap((e) => expandEvent(e.id, e, range));
};

export default source;
