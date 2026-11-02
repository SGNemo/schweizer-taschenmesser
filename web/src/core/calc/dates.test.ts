import { describe, expect, it } from 'vitest';
import { addMonths, addWorkdays, datePhrase, parseDateInput, workdaysBetween } from './dates';

const REF = '2026-10-01'; // a Thursday

describe('addMonths', () => {
  it('clamps to the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15');
    expect(addMonths('2026-03-15', 0.5)).toBeUndefined();
    expect(addMonths('nonsense', 1)).toBeUndefined();
  });
});

describe('working days', () => {
  it('counts Monday to Friday, start inclusive, end exclusive', () => {
    expect(workdaysBetween('2026-10-05', '2026-10-12')).toBe(5); // Mon → next Mon
    expect(workdaysBetween('2026-10-03', '2026-10-05')).toBe(0); // Sat → Mon
    expect(workdaysBetween('2026-10-12', '2026-10-05')).toBe(-5);
    expect(workdaysBetween('2026-10-05', '2026-10-12', ['2026-10-07'])).toBe(4);
    expect(workdaysBetween('x', '2026-10-12')).toBeUndefined();
  });
  it('adds working days over weekends', () => {
    expect(addWorkdays('2026-10-02', 1)).toBe('2026-10-05'); // Fri + 1 = Mon
    expect(addWorkdays('2026-10-05', 5)).toBe('2026-10-12');
    expect(addWorkdays('2026-10-05', -1)).toBe('2026-10-02');
    expect(addWorkdays('2026-10-05', 0)).toBe('2026-10-05');
    expect(addWorkdays('2026-10-05', 2, ['2026-10-06'])).toBe('2026-10-08');
  });
});

describe('parseDateInput', () => {
  it.each([
    ['2026-03-15', '2026-03-15'],
    ['15.03.2026', '2026-03-15'],
    ['15.03.26', '2026-03-15'],
    ['5.3.', '2026-03-05'],
    ['15.03.', '2026-03-15'],
    ['15/03/2026', '2026-03-15'],
    ['heute', REF],
    ['Today', REF],
    ['morgen', '2026-10-02'],
  ])('%s → %s', (input, expected) => {
    expect(parseDateInput(input, REF)).toBe(expected);
  });
  it.each(['31.02.2026', '15.13.2026', 'abc', '2026-03', ''])('rejects %j', (input) => {
    expect(parseDateInput(input, REF)).toBeUndefined();
  });
});

describe('datePhrase', () => {
  const run = (q: string) => datePhrase(q, REF)?.copy;
  it('adds and subtracts days, weeks, months, years in five languages', () => {
    expect(run('15.03. + 45 Tage')).toBe('2026-04-29');
    expect(run('15.03.2026 + 45 days')).toBe('2026-04-29');
    expect(run('15.03.2026 + 2 Wochen')).toBe('2026-03-29');
    expect(run('15.03.2026 - 1 Monat')).toBe('2026-02-15');
    expect(run('15.03.2026 − 1 Monat')).toBe('2026-02-15');
    expect(run('15.03.2026 + 1 an')).toBe('2027-03-15');
    expect(run('15/03/2026 + 3 meses')).toBe('2026-06-15');
    expect(run('15/03/2026 + 10 dias')).toBe('2026-03-25');
    expect(run('=heute + 7 Tage')).toBe('2026-10-08');
  });
  it('adds working days', () => {
    expect(run('2026-10-02 + 1 Arbeitstag')).toBe('2026-10-05');
    expect(run('2026-10-02 + 3 business days')).toBe('2026-10-07');
  });
  it('counts the days between two dates', () => {
    expect(run('15.03.2026 bis 30.04.2026')).toBe('46');
    expect(run('2026-03-15 to 2026-03-01')).toBe('-14');
  });
  it('leaves everything else alone', () => {
    expect(run('15.03.2026')).toBeUndefined();
    expect(run('15.03. + 45 Bananen')).toBeUndefined();
    expect(run('240 + 19%')).toBeUndefined();
  });
});
