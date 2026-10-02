import { describe, expect, it } from 'vitest';
import { formatDateTime, humanDateHint, relativeDayLabel, startOfWeekStr, toEpoch } from './dates';

describe('formatDateTime', () => {
  it('takes day and time from the same local clock (no UTC day around midnight)', () => {
    // 31 Jan 23:30 local: an implementation reading the day from toISOString() would show
    // 1 Feb in any time zone east of UTC.
    const at = new Date(2026, 0, 31, 23, 30).getTime();
    expect(formatDateTime(at)).toBe('31. Jan. 23:30');
    expect(formatDateTime(new Date(2026, 6, 4, 0, 5).getTime())).toBe('4. Juli 00:05');
  });
});

describe('date string helpers', () => {
  it('toEpoch and formatDateTime agree', () => {
    expect(formatDateTime(toEpoch('2026-12-24', '18:00'))).toBe('24. Dez. 18:00');
  });
  it('week start honours Monday and Sunday weeks', () => {
    expect(startOfWeekStr('2026-09-30')).toBe('2026-09-28'); // Wednesday → Monday
    expect(startOfWeekStr('2026-09-27', 7)).toBe('2026-09-27'); // Sunday stays
    expect(startOfWeekStr('2026-09-30', 7)).toBe('2026-09-27');
  });
  it('relative labels', () => {
    expect(relativeDayLabel('2026-09-30', '2026-09-30')).toBe('Heute');
    expect(relativeDayLabel('2026-10-01', '2026-09-30')).toBe('Morgen');
    expect(relativeDayLabel('2026-09-29', '2026-09-30')).toBe('Gestern');
    expect(relativeDayLabel('2026-10-05', '2026-09-30')).toBe('Mo., 5. Okt.');
  });
});

describe('humanDateHint', () => {
  const ref = '2026-09-29'; // Tuesday
  it('says what a date means in words', () => {
    expect(humanDateHint('2026-09-29', ref)).toBe('Heute');
    expect(humanDateHint('2026-09-30', ref)).toBe('Mittwoch, morgen');
    expect(humanDateHint('2026-09-28', ref)).toBe('Montag, gestern');
    expect(humanDateHint('2026-10-05', ref)).toBe('Montag, in 6 Tagen');
    expect(humanDateHint('2026-09-27', ref)).toBe('Sonntag, vor 2 Tagen');
  });
});
