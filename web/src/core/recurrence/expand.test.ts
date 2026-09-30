import { describe, expect, it } from 'vitest';
import { describeRecurrence } from './describe';
import {
  datesInRange,
  firstOnOrAfter,
  iterateOccurrences,
  nextOccurrence,
  occurrencesBetween,
} from './expand';
import { recurrenceSchema, type Recurrence } from './types';

const rule = (r: Partial<Recurrence> & Pick<Recurrence, 'freq'>): Recurrence =>
  recurrenceSchema.parse(r);

describe('recurrence: daily', () => {
  it('repeats every N days from start', () => {
    expect(
      occurrencesBetween(
        rule({ freq: 'daily', interval: 3 }),
        '2026-01-01',
        '2026-01-01',
        '2026-01-12',
      ),
    ).toEqual(['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10']);
  });

  it('never yields dates before the start, even if the range starts earlier', () => {
    expect(
      occurrencesBetween(rule({ freq: 'daily' }), '2026-03-10', '2026-03-01', '2026-03-12'),
    ).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  it('crosses month and year boundaries', () => {
    expect(
      occurrencesBetween(rule({ freq: 'daily' }), '2025-12-30', '2025-12-30', '2026-01-02'),
    ).toHaveLength(4);
  });
});

describe('recurrence: weekly', () => {
  it('defaults to the weekday of the start date', () => {
    // 2026-09-29 is a Tuesday
    expect(
      occurrencesBetween(rule({ freq: 'weekly' }), '2026-09-29', '2026-09-29', '2026-10-20'),
    ).toEqual(['2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20']);
  });

  it('supports several weekdays with interval 2, starting mid-week', () => {
    // Start Wed 2026-09-30; Mon+Fri every 2 weeks → Fri 10-02, then the week of 10-12 (Mon 12, Fri 16)
    const r = rule({ freq: 'weekly', interval: 2, byWeekday: [5, 1] });
    expect(occurrencesBetween(r, '2026-09-30', '2026-09-30', '2026-10-31')).toEqual([
      '2026-10-02',
      '2026-10-12',
      '2026-10-16',
      '2026-10-26',
      '2026-10-30',
    ]);
  });
});

describe('recurrence: monthly', () => {
  it('"every 31st" clamps to the last day of shorter months', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 31 });
    expect(occurrencesBetween(r, '2026-01-31', '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('uses 29 Feb in leap years', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 30 });
    expect(occurrencesBetween(r, '2028-01-30', '2028-02-01', '2028-02-29')).toEqual(['2028-02-29']);
  });

  it('supports the last day of the month (-1)', () => {
    const r = rule({ freq: 'monthly', byMonthDay: -1 });
    expect(occurrencesBetween(r, '2026-01-15', '2026-01-01', '2026-03-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('"every 1st" starting after the 1st begins next month', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 1 });
    expect(occurrencesBetween(r, '2026-09-29', '2026-09-01', '2026-11-30')).toEqual([
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('supports interval (quarterly)', () => {
    const r = rule({ freq: 'monthly', interval: 3 });
    expect(occurrencesBetween(r, '2026-01-15', '2026-01-01', '2026-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
      '2026-10-15',
    ]);
  });

  it('rolls over the year for large intervals', () => {
    const r = rule({ freq: 'monthly', interval: 11 });
    expect(occurrencesBetween(r, '2026-05-10', '2026-05-01', '2028-12-31')).toEqual([
      '2026-05-10',
      '2027-04-10',
      '2028-03-10',
    ]);
  });
});

describe('recurrence: yearly', () => {
  it('repeats on the same date and moves 29 Feb to 28 Feb in non-leap years', () => {
    const r = rule({ freq: 'yearly' });
    expect(occurrencesBetween(r, '2024-02-29', '2024-01-01', '2029-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
      '2029-02-28',
    ]);
  });

  it('honours monthOfYear and byMonthDay', () => {
    const r = rule({ freq: 'yearly', monthOfYear: 12, byMonthDay: 24 });
    expect(occurrencesBetween(r, '2026-01-01', '2026-01-01', '2027-12-31')).toEqual([
      '2026-12-24',
      '2027-12-24',
    ]);
  });
});

describe('recurrence: bounds', () => {
  it('stops after count occurrences (counted from the start)', () => {
    const r = rule({ freq: 'daily', count: 3 });
    expect([...iterateOccurrences(r, '2026-01-01')]).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(occurrencesBetween(r, '2026-01-01', '2026-01-03', '2026-02-01')).toEqual(['2026-01-03']);
  });

  it('stops at until (inclusive)', () => {
    const r = rule({ freq: 'weekly', until: '2026-01-15' });
    expect([...iterateOccurrences(r, '2026-01-01')]).toEqual([
      '2026-01-01',
      '2026-01-08',
      '2026-01-15',
    ]);
  });

  it('returns undefined for next occurrence once the rule ended', () => {
    const r = rule({ freq: 'daily', count: 2 });
    expect(nextOccurrence(r, '2026-01-01', '2026-01-01')).toBe('2026-01-02');
    expect(nextOccurrence(r, '2026-01-01', '2026-01-02')).toBeUndefined();
  });

  it('nextOccurrence is strictly after, firstOnOrAfter is inclusive', () => {
    const r = rule({ freq: 'monthly', byMonthDay: 1 });
    expect(nextOccurrence(r, '2026-01-01', '2026-03-01')).toBe('2026-04-01');
    expect(firstOnOrAfter(r, '2026-01-01', '2026-03-01')).toBe('2026-03-01');
  });
});

describe('datesInRange', () => {
  it('handles one-off items', () => {
    expect(datesInRange('2026-05-05', undefined, '2026-05-01', '2026-05-31')).toEqual([
      '2026-05-05',
    ]);
    expect(datesInRange('2026-06-05', undefined, '2026-05-01', '2026-05-31')).toEqual([]);
  });
});

describe('recurrence schema and description', () => {
  it('validates ranges', () => {
    expect(recurrenceSchema.safeParse({ freq: 'monthly', byMonthDay: 0 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ freq: 'monthly', byMonthDay: -1 }).success).toBe(true);
    expect(recurrenceSchema.safeParse({ freq: 'weekly', byWeekday: [8] }).success).toBe(false);
    expect(recurrenceSchema.parse({ freq: 'daily' }).interval).toBe(1);
  });

  it('describes rules in German', () => {
    expect(describeRecurrence(undefined)).toBe('Einmalig');
    expect(describeRecurrence(rule({ freq: 'monthly', byMonthDay: 1 }))).toBe(
      'Jeden 1. des Monats',
    );
    expect(describeRecurrence(rule({ freq: 'monthly', byMonthDay: -1 }))).toBe(
      'Jeden letzten des Monats',
    );
    expect(describeRecurrence(rule({ freq: 'weekly', interval: 2, byWeekday: [1, 5] }))).toBe(
      'Alle 2 Wochen (Mo, Fr)',
    );
    expect(describeRecurrence(rule({ freq: 'daily', count: 5 }))).toBe('Täglich, 5×');
  });
});
