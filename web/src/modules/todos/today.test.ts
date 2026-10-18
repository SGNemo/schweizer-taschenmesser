import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import type { PickTask } from './next';
import { buildToday, todayAppointments, untilNext } from './today';

const DAY = '2026-10-02';
let n = 0;
const task = (over: Partial<PickTask> = {}): PickTask => ({
  id: over.id ?? `t${++n}`,
  done: false,
  priority: 0,
  order: 0,
  createdAt: 1000 + n,
  ...over,
});
const item = (over: Partial<CalendarItem> = {}): CalendarItem => ({
  id: `i${++n}`,
  source: 'calendar',
  kind: 'event',
  title: 'Termin',
  date: DAY,
  allDay: false,
  ...over,
});

describe('untilNext', () => {
  it('names the next timed open appointment of today and the minutes to it', () => {
    const items = [
      item({ id: 'later', time: '15:00' }),
      item({ id: 'soon', time: '12:30' }),
      item({ id: 'past', time: '08:00' }),
    ];
    expect(untilNext(items, DAY, '12:00')).toMatchObject({ item: { id: 'soon' }, minutes: 30 });
  });

  it('ignores other days, done items, all-day items and ToDos', () => {
    const items = [
      item({ time: '13:00', date: '2026-10-03' }),
      item({ time: '13:00', done: true }),
      item({ allDay: true }),
      item({ time: '13:00', source: 'todos' }),
    ];
    expect(untilNext(items, DAY, '12:00')).toBeUndefined();
  });
});

describe('todayAppointments', () => {
  it('lists all-day first, then by time, without what is over', () => {
    const items = [
      item({ id: 'b', time: '16:00' }),
      item({ id: 'over', time: '08:00', endTime: '09:00' }),
      item({ id: 'a', time: '13:00' }),
      item({ id: 'day', allDay: true }),
      item({ id: 'running', time: '11:00', endTime: '12:30' }),
    ];
    expect(todayAppointments(items, DAY, '12:00').shown.map((i) => i.id)).toEqual([
      'day',
      'running',
      'a',
      'b',
    ]);
  });

  it('caps the list and says how many more there are; leaves ToDos and done items out', () => {
    const items = [
      ...Array.from({ length: 6 }, (_, k) => item({ time: `1${k}:30` })),
      item({ source: 'todos', allDay: true }),
      item({ time: '17:00', done: true }),
    ];
    const out = todayAppointments(items, DAY, '09:00', 4);
    expect(out.shown).toHaveLength(4);
    expect(out.hidden).toBe(2);
  });
});

describe('buildToday', () => {
  const base = { day: DAY, nowHhmm: '09:00', skipped: [], planLimit: 3, showNext: true };

  it('combines suggestion, plan, clock and appointments', () => {
    const planned = task({ id: 'planned', plannedFor: DAY });
    const other = task({ id: 'other', plannedFor: DAY, order: 1 });
    const out = buildToday({
      ...base,
      tasks: [planned, other, task({ id: 'idle' })],
      items: [item({ id: 'dentist', time: '10:00' })],
    });
    expect(out.next?.id).toBe('planned');
    // the suggested task is not repeated in the plan rows
    expect(out.planRows.map((p) => p.id)).toEqual(['other']);
    expect(out.plan.planned).toHaveLength(2);
    expect(out.until).toMatchObject({ minutes: 60 });
    expect(out.appointments.shown.map((i) => i.id)).toEqual(['dentist']);
  });

  it('shows no suggestion when "Jetzt dran" is off, and the plan completely', () => {
    const out = buildToday({
      ...base,
      showNext: false,
      tasks: [task({ id: 'p', plannedFor: DAY })],
      items: [],
    });
    expect(out.next).toBeUndefined();
    expect(out.planRows.map((p) => p.id)).toEqual(['p']);
  });

  it('skipped suggestions do not come back today', () => {
    const out = buildToday({
      ...base,
      skipped: ['a'],
      tasks: [task({ id: 'a', plannedFor: DAY }), task({ id: 'b', plannedFor: DAY, order: 1 })],
      items: [],
    });
    expect(out.next?.id).toBe('b');
  });

  it('an empty day gives empty parts', () => {
    const out = buildToday({ ...base, tasks: [], items: [] });
    expect(out.next).toBeUndefined();
    expect(out.until).toBeUndefined();
    expect(out.appointments).toEqual({ shown: [], hidden: 0 });
  });
});
