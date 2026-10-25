import { describe, expect, it } from 'vitest';
import { groupReminders } from '../reminderGroups';

// Friday 2026-10-02, 10:00 local; the week (Mon start) ends Sunday 2026-10-04.
const NOW = new Date(2026, 9, 2, 10, 0).getTime();
let n = 0;
const r = (
  title: string,
  startDate: string,
  extra: Record<string, unknown> = {},
  startTime = '09:00',
) => ({ title, startDate, startTime, kind: 'reminder' as const, createdAt: ++n, ...extra });
const ids = (list: ReturnType<typeof groupReminders<ReturnType<typeof r>>>) =>
  list.map((g) => `${g.id}:${g.items.map((x) => x.title).join(',')}`);

describe('groupReminders', () => {
  it('puts reminders into Heute, Diese Woche, Später and Erledigt by the next occurrence', () => {
    const list = [
      r('later', '2026-10-20'),
      r('today', '2026-10-02', {}, '18:00'),
      r('tomorrow', '2026-10-03'),
      r('sunday', '2026-10-04'),
      r('nextweek', '2026-10-05'),
      r('over', '2026-09-30'),
      r('paused', '2026-10-02', { notify: { minutesBefore: 0, enabled: false } }, '18:00'),
    ];
    expect(ids(groupReminders(list, NOW))).toEqual([
      'today:today',
      'week:tomorrow,sunday',
      'later:nextweek,later',
      'done:paused,over',
    ]);
  });

  it('a one-off reminder of today whose time has passed is over; a repeat moves to its next date', () => {
    const list = [
      r('passed', '2026-10-02', {}, '08:00'),
      r('daily', '2026-10-01', { recurrence: { freq: 'daily', interval: 1 } }, '08:00'),
    ];
    expect(ids(groupReminders(list, NOW))).toEqual(['week:daily', 'done:passed']);
  });

  it('omits empty groups and handles an empty list', () => {
    expect(groupReminders([], NOW)).toEqual([]);
    expect(ids(groupReminders([r('x', '2026-12-01')], NOW))).toEqual(['later:x']);
  });

  it('is fixed by the clock it is given', () => {
    const list = [r('a', '2026-10-05')];
    expect(ids(groupReminders(list, NOW))).toEqual(['later:a']);
    expect(ids(groupReminders(list, new Date(2026, 9, 5, 7, 0).getTime()))).toEqual(['today:a']);
  });
});
