import { describe, expect, it } from 'vitest';
import type { DayRow } from '@/core/weather/api';
import { weatherWarnings } from './warnings';

const day = (date: string, extra: Partial<DayRow> = {}): DayRow => ({
  date,
  min: 8,
  max: 15,
  group: 'cloudy',
  rain: 10,
  ...extra,
});

describe('weatherWarnings', () => {
  it('stays empty for an ordinary week', () => {
    expect(weatherWarnings([day('2026-10-01'), day('2026-10-02', { gust: 40, mm: 5 })])).toEqual(
      [],
    );
  });

  it('finds a storm, strong gusts, heavy rain, heat and frost on their first day', () => {
    const days = [
      day('2026-10-01', { group: 'thunder' }),
      day('2026-10-02', { gust: 72 }),
      day('2026-10-03', { mm: 24 }),
      day('2026-10-04', { max: 33 }),
      day('2026-10-05', { min: -6 }),
    ];
    expect(weatherWarnings(days, 10).map((w) => [w.kind, w.date, w.value])).toEqual([
      ['storm', '2026-10-01', undefined],
      ['wind', '2026-10-02', 72],
      ['rain', '2026-10-03', 24],
      ['heat', '2026-10-04', 33],
      ['frost', '2026-10-05', -6],
    ]);
  });

  it('reports each kind once, earliest day first, and at most `limit` lines', () => {
    const days = [
      day('2026-10-01', { gust: 80 }),
      day('2026-10-02', { gust: 90, group: 'thunder' }),
      day('2026-10-03', { mm: 30 }),
    ];
    const w = weatherWarnings(days);
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ kind: 'wind', date: '2026-10-01', value: 80 });
    expect(w[1]).toMatchObject({ kind: 'storm', date: '2026-10-02' });
  });

  it('works without optional values', () => {
    expect(weatherWarnings([day('2026-10-01', { gust: undefined, mm: undefined })])).toEqual([]);
    expect(weatherWarnings([])).toEqual([]);
  });

  it('finds ice (freezing drizzle or rain) from each of the codes 56, 57, 66 and 67', () => {
    for (const code of [56, 57, 66, 67]) {
      expect(weatherWarnings([day('2026-11-24', { group: 'rain', code })])).toEqual([
        { kind: 'ice', date: '2026-11-24' },
      ]);
    }
    // Plain rain, drizzle and a value cached without a code are no ice.
    for (const code of [51, 61, 65, undefined]) {
      expect(weatherWarnings([day('2026-11-24', { group: 'rain', code })])).toEqual([]);
    }
  });

  it('orders one day as storm, wind, ice, rain, heat, frost', () => {
    const all = day('2026-11-24', {
      group: 'thunder',
      code: 66,
      gust: 75,
      mm: 25,
      max: 33,
      min: -7,
    });
    expect(weatherWarnings([all], 10).map((w) => w.kind)).toEqual([
      'storm',
      'wind',
      'ice',
      'rain',
      'heat',
      'frost',
    ]);
    expect(
      weatherWarnings([day('2026-11-24', { code: 67, mm: 25, min: -7 })]).map((w) => w.kind),
    ).toEqual(['ice', 'rain']);
  });
});
