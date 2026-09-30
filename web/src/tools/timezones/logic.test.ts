import { describe, expect, it } from 'vitest';
import { isKnownZone, offsetLabel, offsetMinutes, showIn, zonedInstant } from './logic';

const at = (date: string, time: string, zone: string) => {
  const ms = zonedInstant(date, time, zone);
  if (ms === undefined) throw new Error('invalid');
  return ms;
};

describe('offsets', () => {
  it('follow the summer time rules of each zone', () => {
    const winter = Date.UTC(2026, 0, 15, 12);
    const summer = Date.UTC(2026, 6, 1, 12);
    expect(offsetMinutes(winter, 'Europe/Berlin')).toBe(60);
    expect(offsetMinutes(summer, 'Europe/Berlin')).toBe(120);
    expect(offsetMinutes(winter, 'America/New_York')).toBe(-300);
    expect(offsetMinutes(summer, 'America/New_York')).toBe(-240);
    expect(offsetMinutes(winter, 'Asia/Kolkata')).toBe(330);
    expect(offsetMinutes(summer, 'Asia/Tokyo')).toBe(540);
    expect(offsetMinutes(winter, 'UTC')).toBe(0);
  });
  it('are labelled readably', () => {
    expect(offsetLabel(0)).toBe('UTC');
    expect(offsetLabel(120)).toBe('UTC+2');
    expect(offsetLabel(330)).toBe('UTC+5:30');
    expect(offsetLabel(-240)).toBe('UTC−4');
    expect(offsetLabel(-570)).toBe('UTC−9:30');
  });
});

describe('conversion', () => {
  it('converts Berlin noon to other zones, both winter and summer', () => {
    const w = at('2026-01-15', '12:00', 'Europe/Berlin');
    expect(showIn(w, 'America/New_York', 'Europe/Berlin')).toMatchObject({
      date: '2026-01-15',
      time: '06:00',
    });
    expect(showIn(w, 'Asia/Kolkata', 'Europe/Berlin')).toMatchObject({
      time: '16:30',
      offset: 'UTC+5:30',
    });
    const s = at('2026-07-01', '12:00', 'Europe/Berlin');
    expect(showIn(s, 'Asia/Tokyo', 'Europe/Berlin')).toMatchObject({ time: '19:00' });
    expect(showIn(s, 'America/Los_Angeles', 'Europe/Berlin')).toMatchObject({ time: '03:00' });
  });
  it('reports the day difference', () => {
    const late = at('2026-07-01', '23:00', 'Europe/Berlin');
    expect(showIn(late, 'Australia/Sydney', 'Europe/Berlin')).toMatchObject({
      date: '2026-07-02',
      time: '07:00',
      dayDiff: 1,
    });
    const early = at('2026-07-01', '01:00', 'Europe/Berlin');
    expect(showIn(early, 'America/New_York', 'Europe/Berlin')).toMatchObject({
      date: '2026-06-30',
      dayDiff: -1,
    });
    expect(showIn(early, 'Europe/Berlin', 'Europe/Berlin').dayDiff).toBe(0);
  });
  it('round-trips through UTC', () => {
    const ms = at('2026-11-05', '08:15', 'Asia/Tokyo');
    expect(showIn(ms, 'UTC', 'Asia/Tokyo')).toMatchObject({ date: '2026-11-04', time: '23:15' });
    expect(zonedInstant('2026-11-04', '23:15', 'UTC')).toBe(ms);
  });
});

describe('summer time switches', () => {
  it('moves a time that does not exist (spring forward, Berlin 2026-03-29 02:30) to the later hour', () => {
    const ms = at('2026-03-29', '02:30', 'Europe/Berlin');
    expect(showIn(ms, 'Europe/Berlin', 'Europe/Berlin').time).toBe('03:30');
    expect(showIn(ms, 'UTC', 'UTC').time).toBe('01:30');
  });
  it('takes the first occurrence of a repeated hour (fall back, Berlin 2026-10-25 02:30)', () => {
    const ms = at('2026-10-25', '02:30', 'Europe/Berlin');
    expect(showIn(ms, 'UTC', 'UTC').time).toBe('00:30');
  });
  it('handles zones where the switch is on another date', () => {
    const ms = at('2026-03-29', '12:00', 'America/New_York'); // New York switched on 8 March
    expect(showIn(ms, 'UTC', 'UTC').time).toBe('16:00');
  });
});

describe('invalid input', () => {
  it('gives undefined instead of a wrong time', () => {
    expect(zonedInstant('2026-02-30', '10:00', 'UTC')).toBeUndefined();
    expect(zonedInstant('2026-13-01', '10:00', 'UTC')).toBeUndefined();
    expect(zonedInstant('2026-01-01', '24:00', 'UTC')).toBeUndefined();
    expect(zonedInstant('2026-01-01', '10:60', 'UTC')).toBeUndefined();
    expect(zonedInstant('01.01.2026', '10:00', 'UTC')).toBeUndefined();
    expect(zonedInstant('2026-01-01', '10:00', 'Mars/Olympus')).toBeUndefined();
    expect(isKnownZone('Europe/Berlin')).toBe(true);
    expect(isKnownZone('Nowhere/Land')).toBe(false);
  });
});
