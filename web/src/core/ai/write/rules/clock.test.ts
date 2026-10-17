import { describe, expect, it } from 'vitest';
import { fold } from '../../text';
import { looksLikeErrand, settleClock } from './clock';

const NOW = new Date(2026, 8, 29, 10, 0);
const TODAY = '2026-09-29';

describe('settleClock', () => {
  it('keeps a time that is still ahead', () => {
    expect(settleClock({ time: '15:00' }, NOW, TODAY)).toEqual({
      date: undefined,
      time: '15:00',
      rolled: false,
    });
  });
  it('reads "um 3" as 15:00 once 03:00 is over', () => {
    expect(settleClock({ time: '03:00', twelveHour: true }, NOW, TODAY).time).toBe('15:00');
  });
  it('moves a time that is over to tomorrow and flags it', () => {
    expect(settleClock({ time: '08:00' }, NOW, TODAY)).toEqual({
      date: '2026-09-30',
      time: '08:00',
      rolled: true,
    });
    // 09:00 and 21:00 …
    expect(settleClock({ time: '09:00', twelveHour: true }, NOW, TODAY).time).toBe('21:00');
    // … but 22:00 has passed both readings of "um 8"
    const late = new Date(2026, 8, 29, 22, 0);
    expect(settleClock({ time: '08:00', twelveHour: true }, late, TODAY)).toEqual({
      date: '2026-09-30',
      time: '08:00',
      rolled: true,
    });
  });
  it('leaves an explicit day and relative times alone', () => {
    expect(
      settleClock({ date: '2026-09-30', time: '08:00', twelveHour: true }, NOW, TODAY).time,
    ).toBe('08:00');
    expect(settleClock({ date: TODAY, time: '09:00', relative: true }, NOW, TODAY).time).toBe(
      '09:00',
    );
    // "heute um 8" that is over stays today – the preview warns instead of guessing
    expect(settleClock({ date: TODAY, time: '08:00' }, NOW, TODAY)).toMatchObject({
      date: TODAY,
      rolled: false,
    });
  });
});

describe('settleClock: spoken hours', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 29, h, m);
  const settle = (time: string, now: Date) => settleClock({ time, twelveHour: true }, now, TODAY);

  it('"um 3" is the afternoon first, also when that is over (tomorrow 15:00, not 03:00)', () => {
    expect(settle('03:00', at(16))).toEqual({ date: '2026-09-30', time: '15:00', rolled: true });
    expect(settle('03:00', at(10)).time).toBe('15:00');
    expect(settle('05:00', at(18))).toEqual({ date: '2026-09-30', time: '17:00', rolled: true });
  });
  it('"um 9" is the morning while it is ahead, then the evening', () => {
    expect(settle('09:00', at(8)).time).toBe('09:00');
    expect(settle('09:00', at(10)).time).toBe('21:00');
    expect(settle('09:00', at(22))).toEqual({ date: '2026-09-30', time: '09:00', rolled: true });
  });
  it('"halb eins" is whichever 12:30 or 00:30 comes next', () => {
    expect(settle('12:30', at(10)).time).toBe('12:30');
    expect(settle('12:30', at(20))).toEqual({ date: '2026-09-30', time: '00:30', rolled: true });
  });
  it('another named day takes the likely reading without moving the day', () => {
    expect(
      settleClock({ date: '2026-10-05', time: '03:00', twelveHour: true }, at(10), TODAY).time,
    ).toBe('15:00');
    expect(
      settleClock({ date: '2026-10-05', time: '09:00', twelveHour: true }, at(10), TODAY).time,
    ).toBe('09:00');
  });
});

describe('looksLikeErrand', () => {
  it.each([
    'Zahnarzt anrufen',
    'Pizza rausnehmen',
    'Oma anrufen',
    'zahnarzt anrufen',
    'Wäsche aufhängen',
  ])('%s', (t) => expect(looksLikeErrand(t, fold)).toBe(true));
  it.each(['Zahnarzt', 'Treffen mit den Kollegen', 'Meeting', 'Yoga', 'anrufen'])(
    '%s is not',
    (t) => expect(looksLikeErrand(t, fold)).toBe(false),
  );
});
