import { describe, expect, it } from 'vitest';
import { extractFacts } from './extract';

const NOW = new Date(2026, 8, 29, 10, 0); // Tuesday
const f = (s: string) => extractFacts(s, { now: NOW });

describe('spoken clock times', () => {
  it.each([
    ['Viertel nach drei', '03:15'],
    ['Viertel vor fünf', '04:45'],
    ['zehn nach acht', '08:10'],
    ['fünf vor zwölf', '11:55'],
    ['halb vier', '03:30'],
    ['Viertel vier', '03:15'],
    ['dreiviertel vier', '03:45'],
    ['um drei Uhr', '03:00'],
    ['um neun', '09:00'],
    ['um 8 Uhr 15', '08:15'],
    ['halb eins', '12:30'],
  ])('%s → %s (12-hour reading)', (text, time) => {
    const r = f(text);
    expect(r.time).toBe(time);
    expect(!!r.twelveHour).toBe(true);
  });

  it('a 24-hour or zero-padded time is not ambiguous', () => {
    for (const s of ['um 15 Uhr', '15:30', 'um 08:15', '12 Uhr'])
      expect(f(s).twelveHour, s).toBeUndefined();
  });

  it('a part of the day settles it: "abends um 8" is 20:00', () => {
    expect(f('heute Abend um 8')).toMatchObject({ time: '20:00' });
    expect(f('morgen früh um 8')).toMatchObject({ time: '08:00' });
    expect(f('Montag nachmittags um halb vier')).toMatchObject({ time: '15:30' });
    expect(f('heute Abend um 8').twelveHour).toBeUndefined();
  });

  it('does not take amounts for hours', () => {
    expect(f('um 5 Euro').time).toBeUndefined();
  });
});

describe('relative times', () => {
  it.each([
    ['in zwei Stunden', '12:00'],
    ['in einer Viertelstunde', '10:15'],
    ['in einer halben Stunde', '10:30'],
    ['in anderthalb Stunden', '11:30'],
    ['in zwanzig Minuten', '10:20'],
    ['in 90 Minuten', '11:30'],
  ])('%s → %s', (text, time) => {
    const r = f(text);
    expect(r).toMatchObject({ time, date: '2026-09-29', relative: true });
  });
  it('days in words', () => {
    expect(f('in drei Tagen').date).toBe('2026-10-02');
  });
});

describe('"um" that is not a clock time', () => {
  it.each([
    'Zahnarzt anrufen, um einen Termin zu vereinbaren',
    'um 4 Eier zu kaufen',
    'um einen Termin zu machen',
    'um 4 Eier einzukaufen',
    'um eine Pizza zu bestellen',
  ])('%s has no time', (text) => {
    expect(f(text).time).toBeUndefined();
  });

  it('keeps real times', () => {
    expect(f('um ein Uhr').time).toBe('01:00');
    expect(f('um 4 Uhr, Eier zu kaufen').time).toBe('04:00');
    expect(f('um 4 Eier kaufen').time).toBe('04:00');
  });
});

describe('night and midnight', () => {
  it.each([
    ['heute Nacht um 2', '02:00'],
    ['nachts um halb drei', '02:30'],
    ['heute Nacht um 11', '23:00'],
    ['um 12 Uhr nachts', '00:00'],
    ['um 12 Uhr mittags', '12:00'],
    ['um 12 Uhr', '12:00'],
  ])('%s → %s', (text, time) => {
    expect(f(text).time).toBe(time);
  });
});
