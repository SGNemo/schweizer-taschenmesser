import { describe, expect, it } from 'vitest';
import {
  freeSpans,
  parseTime,
  parseWindow,
  placeInWindow,
  SESSION_GAP_MIN,
  spanMin,
  validWindow,
  windowText,
} from './windows';

const W = { from: '09:00', to: '17:00' };
const s = (id: string, minutes: number) => ({ id, minutes });

describe('parseWindow / parseTime', () => {
  it.each([
    ['09:00–17:00', '09:00', '17:00'],
    ['9-17', '09:00', '17:00'],
    ['9:30 - 12', '09:30', '12:00'],
    ['08.15—16.45', '08:15', '16:45'],
    ['9 bis 17', '09:00', '17:00'],
  ])('%s → %s–%s', (text, from, to) => {
    expect(parseWindow(text)).toEqual({ from, to });
  });

  it.each(['', '17-9', '9', '9-9', '25-26', 'morgens', '9-12-15'])(
    '%s is no window',
    (text) => {
      expect(parseWindow(text)).toBeUndefined();
    },
  );

  it('normalises single times and writes a window back', () => {
    expect(parseTime('7')).toBe('07:00');
    expect(parseTime('24:00')).toBeUndefined();
    expect(windowText({ from: '09:00', to: '17:00' })).toBe('09:00–17:00');
    expect(validWindow({ from: '10:00' })).toBeUndefined();
    expect(spanMin({ from: '14:00', to: '16:30' })).toBe(150);
    expect(spanMin({ from: '16:00', to: '14:00' })).toBeUndefined();
  });
});

describe('freeSpans', () => {
  it('cuts timed blockers out of the window, ignores blockers without times', () => {
    expect(
      freeSpans(W, [
        { from: '12:00', to: '13:00' },
        {},
        { from: '08:00', to: '09:30' },
        { from: '12:30', to: '13:30' },
        { from: '16:30', to: '18:00' },
      ]),
    ).toEqual([
      [570, 720],
      [810, 990],
    ]);
  });

  it('a blocker over the whole window leaves nothing', () => {
    expect(freeSpans(W, [{ from: '08:00', to: '18:00' }])).toEqual([]);
  });
});

describe('placeInWindow', () => {
  it('lays sessions in order with a short pause, on the 5-minute grid', () => {
    const out = placeInWindow(W, [], [s('a', 90), s('b', 25), s('c', 30)]);
    expect(Object.fromEntries(out)).toEqual({
      a: { from: '09:00', to: '10:30' },
      b: { from: '10:45', to: '11:10' },
      c: { from: '11:25', to: '11:55' },
    });
    expect(SESSION_GAP_MIN).toBe(15);
  });

  it('jumps over a timed blocker and never splits or shortens a session', () => {
    const out = placeInWindow(W, [{ from: '10:00', to: '12:00' }], [s('a', 90), s('b', 60)]);
    expect(Object.fromEntries(out)).toEqual({
      a: { from: '12:00', to: '13:30' },
      b: { from: '13:45', to: '14:45' },
    });
  });

  it('a session that does not fit keeps no time; a later, shorter one may still fit', () => {
    const out = placeInWindow({ from: '09:00', to: '11:00' }, [], [s('a', 60), s('b', 90), s('c', 30)]);
    expect([...out.keys()]).toEqual(['a', 'c']);
    expect(out.get('c')).toEqual({ from: '10:15', to: '10:45' });
  });

  it('is deterministic: the same input gives the same output', () => {
    const input = [s('a', 45), s('b', 60), s('c', 10)];
    const blockers = [{ from: '11:00', to: '11:30' }];
    expect(placeInWindow(W, blockers, input)).toEqual(placeInWindow(W, blockers, input));
  });
});
