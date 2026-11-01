import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import { minutesUntil, nextAppointment } from './cockpitStats';

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: 'x',
  source: 'calendar',
  kind: 'event',
  title: 'Termin',
  date: '2026-11-01',
  allDay: false,
  ...over,
});

describe('cockpit big stats', () => {
  it('picks the first timed appointment that has not started; all-day and done ones never count', () => {
    const items = [
      item({ id: 'past', time: '08:00' }),
      item({ id: 'allday', allDay: true }),
      item({ id: 'done', time: '15:00', done: true }),
      item({ id: 'later', time: '16:30' }),
      item({ id: 'next', time: '14:05' }),
    ];
    expect(nextAppointment(items, '13:50')?.id).toBe('next');
    expect(nextAppointment(items, '16:30')?.id).toBe('later');
    expect(nextAppointment(items, '17:00')).toBeUndefined();
    expect(nextAppointment([], '09:00')).toBeUndefined();
  });

  it('counts whole minutes until a time and never goes negative', () => {
    expect(minutesUntil('14:05', '13:50')).toBe(15);
    expect(minutesUntil('14:05', '14:05')).toBe(0);
    expect(minutesUntil('09:00', '09:30')).toBe(0);
  });
});
