import { describe, expect, it } from 'vitest';
import { nextFullHour, remindAt } from '../logic';

describe('remindAt', () => {
  it('converts a place wall time to here, one date with and one without a DST switch at one place only', () => {
    // 1 March: Berlin UTC+1, New York UTC−5 → 19:00 in New York is 01:00 the next day in Berlin.
    expect(remindAt('2026-03-01', '19:00', 'America/New_York', 'Europe/Berlin')).toMatchObject({
      date: '2026-03-02',
      time: '01:00',
      dayDiff: 1,
    });
    // 15 March: New York already switched (8 March), Berlin not yet (29 March) → only 5 h difference.
    expect(remindAt('2026-03-15', '19:00', 'America/New_York', 'Europe/Berlin')).toMatchObject({
      date: '2026-03-16',
      time: '00:00',
      dayDiff: 1,
    });
  });

  it('follows the switch here while the place has none (Tokyo, Berlin in summer)', () => {
    expect(remindAt('2026-01-11', '19:00', 'Asia/Tokyo', 'Europe/Berlin')).toMatchObject({
      date: '2026-01-11',
      time: '11:00',
      dayDiff: 0,
    });
    expect(remindAt('2026-07-12', '19:00', 'Asia/Tokyo', 'Europe/Berlin')).toMatchObject({
      date: '2026-07-12',
      time: '12:00',
    });
  });

  it('moves the place earlier day back here (Los Angeles morning is Berlin evening)', () => {
    expect(remindAt('2026-01-11', '09:00', 'America/Los_Angeles', 'Europe/Berlin')).toMatchObject({
      date: '2026-01-11',
      time: '18:00',
      dayDiff: 0,
    });
    expect(remindAt('2026-01-11', '08:00', 'Asia/Tokyo', 'America/Los_Angeles')).toMatchObject({
      date: '2026-01-10',
      time: '15:00',
      dayDiff: -1,
    });
  });

  it('refuses invalid input', () => {
    expect(remindAt('2026-02-30', '19:00', 'Asia/Tokyo', 'Europe/Berlin')).toBeUndefined();
    expect(remindAt('2026-01-11', '25:00', 'Asia/Tokyo', 'Europe/Berlin')).toBeUndefined();
    expect(remindAt('2026-01-11', '19:00', 'Mars/Olympus', 'Europe/Berlin')).toBeUndefined();
  });
});

describe('nextFullHour', () => {
  it('starts at the next full hour on the place wall clock, crossing midnight there', () => {
    // 14:20 UTC = 23:20 in Tokyo → 00:00 the next day there.
    expect(nextFullHour(Date.parse('2026-01-11T14:20:00Z'), 'Asia/Tokyo')).toEqual({
      date: '2026-01-12',
      time: '00:00',
    });
    // A half-hour zone: 10:10 UTC = 15:40 in Kolkata → 16:00.
    expect(nextFullHour(Date.parse('2026-01-11T10:10:00Z'), 'Asia/Kolkata')).toEqual({
      date: '2026-01-11',
      time: '16:00',
    });
    // On the full hour it is the following one.
    expect(nextFullHour(Date.parse('2026-01-11T10:00:00Z'), 'UTC')).toEqual({
      date: '2026-01-11',
      time: '11:00',
    });
  });
});
