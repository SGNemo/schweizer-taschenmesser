import { describe, expect, it } from 'vitest';
import {
  eventIdOf,
  expandEvent,
  groupByDate,
  monthWeeks,
  rangeFor,
  shiftDate,
  splitDay,
  viewTitle,
} from './views';
import type { CalendarItem } from '@/core/modules/types';
import { eventSchema } from './schema';

const ev = (over: Record<string, unknown>) =>
  eventSchema.parse({ title: 'E', startDate: '2026-09-29', ...over });

describe('calendar views', () => {
  it('computes ranges (Monday-first weeks)', () => {
    expect(rangeFor('day', '2026-09-29')).toEqual({ from: '2026-09-29', to: '2026-09-29' });
    expect(rangeFor('week', '2026-09-29')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    // September 2026 starts on Tuesday and ends on Wednesday → grid Mon 08-31 … Sun 10-04
    expect(rangeFor('month', '2026-09-15')).toEqual({ from: '2026-08-31', to: '2026-10-04' });
  });

  it('builds month weeks of seven days', () => {
    const weeks = monthWeeks('2026-09-15');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]![0]).toBe('2026-08-31');
    expect(weeks[4]![6]).toBe('2026-10-04');
  });

  it('shifts by view unit', () => {
    expect(shiftDate('day', '2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDate('week', '2026-09-29', -1)).toBe('2026-09-22');
    expect(shiftDate('month', '2026-01-31', 1)).toBe('2026-02-01'); // month view resets to the 1st
    expect(shiftDate('month', '2026-01-15', -1)).toBe('2025-12-01');
  });

  it('formats titles in German', () => {
    expect(viewTitle('month', '2026-09-29')).toBe('September 2026');
    expect(viewTitle('day', '2026-09-29')).toBe('Dienstag, 29. September 2026');
    expect(viewTitle('week', '2026-09-29')).toBe('KW 40 · 28. Sep. – 4. Okt. 2026');
  });

  it('groups items by date', () => {
    const map = groupByDate([
      { id: 'a', source: 's', kind: 'k', title: 'a', date: '2026-01-01', allDay: true },
      { id: 'b', source: 's', kind: 'k', title: 'b', date: '2026-01-01', allDay: true },
      { id: 'c', source: 's', kind: 'k', title: 'c', date: '2026-01-02', allDay: true },
    ]);
    expect(map.get('2026-01-01')).toHaveLength(2);
    expect(map.get('2026-01-02')).toHaveLength(1);
  });
});

describe('expandEvent', () => {
  const range = { from: '2026-09-01', to: '2026-09-30' };

  it('single timed event', () => {
    const items = expandEvent('e1', ev({ startTime: '14:00', endTime: '15:30' }), range);
    expect(items).toEqual([
      expect.objectContaining({
        id: 'e1:2026-09-29',
        date: '2026-09-29',
        time: '14:00',
        endTime: '15:30',
        allDay: false,
      }),
    ]);
  });

  it('all-day event has no time', () => {
    const [i] = expandEvent('e1', ev({ allDay: true, startTime: '10:00' }), range);
    expect(i).toMatchObject({ allDay: true, time: undefined });
  });

  it('multi-day event yields one item per covered day, time only on the first', () => {
    const items = expandEvent(
      'e1',
      ev({ startDate: '2026-09-10', endDate: '2026-09-12', startTime: '09:00', endTime: '17:00' }),
      range,
    );
    expect(items.map((i) => [i.date, i.time, i.endTime, i.allDay])).toEqual([
      ['2026-09-10', '09:00', undefined, false],
      ['2026-09-11', undefined, undefined, true],
      ['2026-09-12', undefined, '17:00', true],
    ]);
  });

  it('multi-day event starting before the range still shows the covered days', () => {
    const items = expandEvent(
      'e1',
      ev({ startDate: '2026-08-30', endDate: '2026-09-02', allDay: true }),
      range,
    );
    expect(items.map((i) => i.date)).toEqual(['2026-09-01', '2026-09-02']);
  });

  it('recurring event expands per occurrence', () => {
    const items = expandEvent(
      'e1',
      ev({ startDate: '2026-09-01', startTime: '18:00', recurrence: { freq: 'weekly' } }),
      range,
    );
    expect(items.map((i) => i.date)).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
      '2026-09-29',
    ]);
  });

  it('recurring multi-day event whose earlier occurrence overlaps the range start', () => {
    const items = expandEvent(
      'e1',
      ev({
        startDate: '2026-08-30',
        endDate: '2026-09-01',
        allDay: true,
        recurrence: { freq: 'monthly', byMonthDay: 30 },
      }),
      { from: '2026-09-01', to: '2026-09-05' },
    );
    expect(items.map((i) => i.date)).toEqual(['2026-09-01']);
  });

  it('extracts the event id from an item id', () => {
    expect(eventIdOf('abc-123:2026-09-29')).toBe('abc-123');
  });
});

describe('event schema', () => {
  it('rejects an end before the start', () => {
    expect(
      eventSchema.safeParse({ title: 'x', startDate: '2026-05-02', endDate: '2026-05-01' }).success,
    ).toBe(false);
    expect(
      eventSchema.safeParse({
        title: 'x',
        startDate: '2026-05-01',
        startTime: '10:00',
        endTime: '09:00',
      }).success,
    ).toBe(false);
    expect(
      eventSchema.safeParse({
        title: 'x',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        startTime: '10:00',
        endTime: '09:00',
      }).success,
    ).toBe(true);
  });
});

describe('splitDay', () => {
  const at = (id: string, time?: string, endTime?: string, allDay = false): CalendarItem => ({
    id,
    source: 'calendar',
    kind: 'event',
    title: id,
    date: '2026-09-29',
    time,
    endTime,
    allDay,
  });

  it('separates untimed items and defaults the duration to one hour', () => {
    const { untimed, timed } = splitDay([at('a', undefined, undefined, true), at('b', '09:00')]);
    expect(untimed.map((i) => i.id)).toEqual(['a']);
    expect(timed).toHaveLength(1);
    expect([timed[0]!.start, timed[0]!.end]).toEqual([540, 600]);
  });

  it('puts overlapping items into separate lanes and reuses lanes afterwards', () => {
    const { timed } = splitDay([
      at('a', '09:00', '10:30'),
      at('b', '10:00', '11:00'),
      at('c', '12:00', '13:00'),
    ]);
    const by = Object.fromEntries(timed.map((t) => [t.item.id, t]));
    expect([by.a!.lane, by.a!.lanes]).toEqual([0, 2]);
    expect([by.b!.lane, by.b!.lanes]).toEqual([1, 2]);
    expect([by.c!.lane, by.c!.lanes]).toEqual([0, 1]);
  });

  it('gives very short items a minimum height and clamps to midnight', () => {
    const { timed } = splitDay([at('a', '09:00', '09:05'), at('b', '23:30', '01:00')]);
    expect(timed[0]!.end - timed[0]!.start).toBe(30);
    expect(timed[1]!.end).toBe(24 * 60);
  });
});
