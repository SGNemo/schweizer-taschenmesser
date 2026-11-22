/** The lock words of the planner's field (planner rethink package 2, CONCEPT §4): only next to a day. */
import { describe, expect, it } from 'vitest';
import { extractLock } from '../dueWords';

const MON = '2026-11-16';

describe('extractLock', () => {
  it.each([
    ['Zahnarzt Do fest', { text: 'Zahnarzt', date: '2026-11-19' }],
    ['Zahnarzt Do lock', { text: 'Zahnarzt', date: '2026-11-19' }],
    ['Zahnarzt Do!', { text: 'Zahnarzt', date: '2026-11-19' }],
    ['Zahnarzt Mo. fest', { text: 'Zahnarzt', date: MON }],
    // A day the parser reads stays in the text: the caller asks the parser.
    ['Zahnarzt 7.12. fest', { text: 'Zahnarzt 7.12.' }],
    ['Zahnarzt Donnerstag!', { text: 'Zahnarzt Donnerstag' }],
    // No day here: the caller keeps the line as it is.
    ['Bin fest', { text: 'Bin' }],
    // „so“ in lower case is a word, not Sunday.
    ['Mach das so fest', { text: 'Mach das so' }],
    // A weekday after a deadline word is the deadline, no day: nothing is read as the lock's day.
    ['Steuer bis Fr fest', { text: 'Steuer bis Fr' }],
    ['Rechnung zahlen Frist Do!', { text: 'Rechnung zahlen Frist Do' }],
  ])('%s', (line, out) => {
    expect(extractLock(line, MON)).toEqual(out);
  });

  it.each(['Zahnarzt Do', 'Festival Do', 'fest', '!', 'Wow!!', 'Zahnarzt festlegen'])(
    '%s has no lock word',
    (line) => {
      expect(extractLock(line, MON)).toBeUndefined();
    },
  );
});
