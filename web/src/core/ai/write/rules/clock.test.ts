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
