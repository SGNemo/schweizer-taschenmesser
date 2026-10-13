import { describe, expect, it } from 'vitest';
import { presetDate, shiftDays, shiftMinutes, snoozeTarget } from './quickShift';

describe('presetDate', () => {
  it('today, tomorrow and next Monday from a Tuesday', () => {
    expect(presetDate('today', '2026-09-29')).toBe('2026-09-29');
    expect(presetDate('tomorrow', '2026-09-29')).toBe('2026-09-30');
    expect(presetDate('nextWeek', '2026-09-29')).toBe('2026-10-05');
  });
  it('next week from a Monday is the Monday after, from a Sunday the next day', () => {
    expect(presetDate('nextWeek', '2026-09-28')).toBe('2026-10-05');
    expect(presetDate('nextWeek', '2026-10-04')).toBe('2026-10-05');
  });
});

describe('shifts', () => {
  it('moves days across a month end', () => {
    expect(shiftDays('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('moves minutes across midnight, forwards and backwards', () => {
    expect(shiftMinutes('2026-09-29', '23:30', 60)).toEqual({ date: '2026-09-30', time: '00:30' });
    expect(shiftMinutes('2026-09-29', '00:10', -20)).toEqual({ date: '2026-09-28', time: '23:50' });
    expect(shiftMinutes('2026-09-29', '09:00', 10)).toEqual({ date: '2026-09-29', time: '09:10' });
  });
  it('snooze targets: an hour later, tomorrow 09:00', () => {
    const at = new Date('2026-09-29T10:05:00').getTime();
    expect(snoozeTarget('1h', at)).toEqual({ date: '2026-09-29', time: '11:05' });
    expect(snoozeTarget('tomorrow', at)).toEqual({ date: '2026-09-30', time: '09:00' });
    expect(snoozeTarget('evening', at)).toEqual({ date: '2026-09-29', time: '18:00' });
  });
});
