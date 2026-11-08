import { notDeleted } from '@/core/db/repo';
import type { CalendarItem, CalendarSource } from '@/core/modules/types';
import { t } from '@/strings';
import { sessionTitle } from './data';
import { sessionRepo } from './repo';

/**
 * Logged sessions in the calendar (`done`, so they never block the planner). Meals are left out on
 * purpose: they would only add noise to the days.
 */
const source: CalendarSource = async (range) => {
  const sessions = (
    await sessionRepo.table.where('date').between(range.from, range.to, true, true).toArray()
  ).filter(notDeleted);
  return sessions.map<CalendarItem>((s) => ({
    id: s.id,
    source: 'fitness',
    kind: 'training',
    title: t.fitness.calendar.session(sessionTitle(s)),
    date: s.date,
    ...(s.time ? { time: s.time } : {}),
    allDay: !s.time,
    done: true,
    to: `/fitness?open=${s.id}`,
  }));
};

export default source;
