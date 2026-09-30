import { describe, expect, it } from 'vitest';
import { describeRecurrence, monthName, weekdayShort } from './describe';
import type { Recurrence } from './types';

const rule = (r: Partial<Recurrence> & Pick<Recurrence, 'freq'>): Recurrence => ({
  interval: 1,
  ...r,
});

describe('describeRecurrence', () => {
  it('describes a missing rule as one-off', () => {
    expect(describeRecurrence(undefined)).toBe('Einmalig');
  });

  it('describes daily rules', () => {
    expect(describeRecurrence(rule({ freq: 'daily' }))).toBe('Täglich');
    expect(describeRecurrence(rule({ freq: 'daily', interval: 3 }))).toBe('Alle 3 Tage');
  });

  it('describes weekly rules with sorted weekdays', () => {
    expect(describeRecurrence(rule({ freq: 'weekly' }))).toBe('Wöchentlich');
    expect(describeRecurrence(rule({ freq: 'weekly', byWeekday: [5, 1] }))).toBe(
      'Wöchentlich (Mo, Fr)',
    );
    expect(describeRecurrence(rule({ freq: 'weekly', interval: 2, byWeekday: [7] }))).toBe(
      'Alle 2 Wochen (So)',
    );
  });

  it('describes monthly rules', () => {
    expect(describeRecurrence(rule({ freq: 'monthly' }))).toBe('Monatlich');
    expect(describeRecurrence(rule({ freq: 'monthly', interval: 2 }))).toBe('Alle 2 Monate');
    expect(describeRecurrence(rule({ freq: 'monthly', byMonthDay: 1 }))).toBe(
      'Jeden 1. des Monats',
    );
    expect(describeRecurrence(rule({ freq: 'monthly', byMonthDay: -1 }))).toBe(
      'Jeden letzten des Monats',
    );
    expect(describeRecurrence(rule({ freq: 'monthly', interval: 3, byMonthDay: 15 }))).toBe(
      'Jeden 15. alle 3 Monate',
    );
  });

  it('describes yearly rules', () => {
    expect(describeRecurrence(rule({ freq: 'yearly' }))).toBe('Jährlich');
    expect(describeRecurrence(rule({ freq: 'yearly', byMonthDay: 24, monthOfYear: 12 }))).toBe(
      'Jährlich am 24. Dezember',
    );
    expect(describeRecurrence(rule({ freq: 'yearly', byMonthDay: -1, monthOfYear: 2 }))).toBe(
      'Jährlich am Monatsende Februar',
    );
    expect(describeRecurrence(rule({ freq: 'yearly', interval: 2 }))).toBe('Alle 2 Jahre');
  });

  it('appends the count and end date', () => {
    expect(describeRecurrence(rule({ freq: 'daily', count: 5 }))).toBe('Täglich, 5×');
    expect(describeRecurrence(rule({ freq: 'daily', until: '2030-01-31' }))).toMatch(
      /^Täglich, bis 31\. .+ 2030$/,
    );
  });
});

describe('name helpers', () => {
  it('maps ISO weekdays and months, empty outside the range', () => {
    expect(weekdayShort(1)).toBe('Mo');
    expect(weekdayShort(7)).toBe('So');
    expect(weekdayShort(0)).toBe('');
    expect(monthName(3)).toBe('März');
    expect(monthName(13)).toBe('');
  });
});
