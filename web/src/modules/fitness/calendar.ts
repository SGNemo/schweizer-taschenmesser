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
  const sessions = (await sessionRepo.table.filter(notDeleted).toArray()).filter(
    (s) => s.date >= range.from && s.date <= range.to,
  );
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
