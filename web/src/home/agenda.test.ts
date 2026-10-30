import { describe, expect, it } from 'vitest';
import type { CalendarItem } from '@/core/modules/types';
import { buildAgenda, LIMITS } from './agenda';

const ALL = LIMITS.all;

const DAY = '2026-10-29'; // Thursday
const item = (id: string, date: string, extra: Partial<CalendarItem> = {}): CalendarItem => ({
  id,
  source: 'calendar',
  kind: 'event',
  title: id,
  date,
  allDay: false,
  time: '09:00',
  ...extra,
});

describe('buildAgenda', () => {
  it('groups today, tomorrow and the rest of the week', () => {
    const a = buildAgenda(
      [
        item('a', '2026-10-29'),
        item('b', '2026-10-30'),
        item('c', '2026-11-02'),
        item('d', '2026-11-02', { time: '10:00' }),
        item('far', '2026-11-05'),
      ],
      DAY,
    );
    expect(a.today.map((i) => i.id)).toEqual(['a']);
    expect(a.tomorrow.map((i) => i.id)).toEqual(['b']);
    expect(a.week.map((d) => [d.date, d.items.length])).toEqual([['2026-11-02', 2]]);
    expect(a.empty).toBe(false);
  });

  it('names a multi-day event once, on its first day in range', () => {
    const a = buildAgenda(
      [
        item('trip', '2026-10-30'),
        item('trip', '2026-10-31', { continued: true }),
        item('trip', '2026-11-01', { continued: true }),
        // Started before today: its first day in range is today, continued or not.
        item('fair', '2026-10-29', { continued: true }),
        item('fair', '2026-10-30', { continued: true }),
      ],
      DAY,
    );
    expect(a.today.map((i) => i.id)).toEqual(['fair']);
    expect(a.tomorrow.map((i) => i.id)).toEqual(['trip']);
    expect(a.week).toEqual([]);
    expect(a.hidden).toBe(0);
  });

  it('leaves out done items and the ToDos due today (the "Heute" card lists them)', () => {
    const a = buildAgenda(
      [
        item('done', DAY, { done: true }),
        item('task', DAY, { source: 'todos' }),
        item('reminder', DAY, { kind: 'reminder' }),
        item('task-tomorrow', '2026-10-30', { source: 'todos' }),
      ],
      DAY,
    );
    expect(a.today.map((i) => i.id)).toEqual(['reminder']);
    expect(a.tomorrow.map((i) => i.id)).toEqual(['task-tomorrow']);
  });

  it('shows fewer entries in the calm view', () => {
    const many = Array.from({ length: 6 }, (_, i) => item(`t${i}`, DAY));
    const a = buildAgenda(many, DAY, LIMITS.calm);
    expect(a.today).toHaveLength(LIMITS.calm.today);
    expect(a.hidden).toBe(6 - LIMITS.calm.today);
  });

  it('is empty when nothing is coming up, and counts what the limits cut off', () => {
    expect(buildAgenda([], DAY).empty).toBe(true);
    const many = Array.from({ length: ALL.today + 2 }, (_, i) => item(`t${i}`, DAY));
    const a = buildAgenda(many, DAY);
    expect(a.today).toHaveLength(ALL.today);
    expect(a.hidden).toBe(2);
  });
});
