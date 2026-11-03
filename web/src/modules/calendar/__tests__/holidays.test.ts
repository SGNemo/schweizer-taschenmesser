import { describe, expect, it } from 'vitest';
import { easterSunday, holidayMap, holidaysBetween, holidaysOf } from '../holidays';

const dates = (year: number, region: Parameters<typeof holidaysOf>[1]) =>
  Object.fromEntries(holidaysOf(year, region).map((h) => [h.id, h.date]));

describe('holidays', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2024)).toBe('2024-03-31');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2038)).toBe('2038-04-25');
  });

  it('is empty when off', () => {
    expect(holidaysOf(2026, 'off')).toEqual([]);
    expect(holidaysBetween('2026-01-01', '2026-12-31', 'off')).toEqual([]);
  });

  it('derives the movable national days from Easter (2026)', () => {
    const d = dates(2026, 'de');
    expect(d.goodFriday).toBe('2026-04-03');
    expect(d.easterMonday).toBe('2026-04-06');
    expect(d.ascension).toBe('2026-05-14');
    expect(d.whitMonday).toBe('2026-05-25');
    expect(d.unityDay).toBe('2026-10-03');
    expect(d.epiphany).toBeUndefined();
  });

  it('adds state days only for the chosen state', () => {
    expect(dates(2026, 'de-by').epiphany).toBe('2026-01-06');
    expect(dates(2026, 'de-by').corpusChristi).toBe('2026-06-04');
    expect(dates(2026, 'de-nw').reformationDay).toBeUndefined();
    expect(dates(2026, 'de-sn').reformationDay).toBe('2026-10-31');
    expect(dates(2026, 'de-be').womensDay).toBe('2026-03-08');
    expect(dates(2026, 'de-th').childrensDay).toBe('2026-09-20');
  });

  it('finds Buß- und Bettag (Wednesday before 23 Nov)', () => {
    expect(dates(2026, 'de-sn').repentance).toBe('2026-11-18');
    expect(dates(2025, 'de-sn').repentance).toBe('2025-11-19');
    // 23 Nov is itself a Wednesday in 2022: the one before it.
    expect(dates(2022, 'de-sn').repentance).toBe('2022-11-16');
  });

  it('has Austrian and Swiss sets', () => {
    expect(dates(2026, 'at').austriaNationalDay).toBe('2026-10-26');
    expect(dates(2026, 'ch').swissNationalDay).toBe('2026-08-01');
    expect(dates(2026, 'ch').labourDay).toBeUndefined();
  });

  it('covers ranges across a year boundary and builds a lookup', () => {
    const list = holidaysBetween('2025-12-20', '2026-01-10', 'de-by');
    expect(list.map((h) => h.date)).toEqual([
      '2025-12-25',
      '2025-12-26',
      '2026-01-01',
      '2026-01-06',
    ]);
    expect(holidayMap('2026-12-24', '2026-12-26', 'de').get('2026-12-25')).toBe('christmas');
  });
});
