import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import { estimateKcal } from '../goal';
import {
  byDay,
  daySum,
  exerciseSuggestions,
  foodSuggestions,
  lastOf,
  latestSession,
  repeatSession,
  sessionMinutes,
  weekOf,
  weekSummary,
} from '../logic';
import manifest from '../manifest';
import { mealSchema, sessionSchema } from '../schema';

describe('fitness module', () => {
  it('has a valid manifest: preview, off by default, out of the data API, in Haushalt', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.maturity).toBe('preview');
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.dataApi).toBe(false);
    expect(manifest.area).toBe('household');
  });

  it('never makes entries searchable for the assistant', () => {
    for (const c of Object.values(manifest.aiSchema!.collections))
      expect(c.searchable).toBeUndefined();
  });

  it('validates sessions and meals', () => {
    expect(sessionSchema.parse({ date: '2026-11-08' }).exercises).toEqual([]);
    expect(sessionSchema.safeParse({ date: '8.11.' }).success).toBe(false);
    expect(
      sessionSchema.safeParse({ date: '2026-11-08', exercises: [{ name: ' ' }] }).success,
    ).toBe(false);
    expect(mealSchema.safeParse({ date: '2026-11-08', text: 'Döner', kcal: 650 }).success).toBe(
      true,
    );
    expect(mealSchema.safeParse({ date: '2026-11-08', text: 'Döner', kcal: 6.5 }).success).toBe(
      false,
    );
    expect(mealSchema.safeParse({ date: '2026-11-08', text: '', kcal: 1 }).success).toBe(false);
  });
});

describe('fitness logic', () => {
  const s = (date: string, extra: object = {}) => ({ date, exercises: [], ...extra });

  it('sums a week (Monday start and Sunday start)', () => {
    expect(weekOf('2026-11-08', 1)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(weekOf('2026-11-08', 7)).toEqual({ from: '2026-11-08', to: '2026-11-14' });
    const sessions = [
      s('2026-11-01', { durationMin: 40 }),
      s('2026-11-03', { durationMin: 55 }),
      s('2026-11-05', { exercises: [{ name: 'Laufen', durationMin: 35 }] }),
    ];
    expect(weekSummary(sessions, weekOf('2026-11-08'))).toEqual({ count: 2, minutes: 90 });
  });

  it('prefers the session duration over the sum of its exercises', () => {
    expect(sessionMinutes({ durationMin: 60, exercises: [{ name: 'a', durationMin: 10 }] })).toBe(
      60,
    );
    expect(sessionMinutes({ exercises: [{ name: 'a' }] })).toBe(0);
  });

  it('sums kcal of one day only', () => {
    const meals = [
      { date: '2026-11-08', kcal: 350 },
      { date: '2026-11-08', kcal: 650 },
      { date: '2026-11-07', kcal: 900 },
    ];
    expect(daySum(meals, '2026-11-08')).toBe(1000);
    expect(daySum([], '2026-11-08')).toBe(0);
  });

  it('remembers own foods with their latest kcal, newest first, case-insensitive', () => {
    const meals = [
      { date: '2026-11-01', text: 'Döner', kcal: 600 },
      { date: '2026-11-05', text: 'döner ', kcal: 650 },
      { date: '2026-11-03', text: 'Apfel', kcal: 80 },
    ];
    expect(foodSuggestions(meals)).toEqual([
      { text: 'döner', kcal: 650 },
      { text: 'Apfel', kcal: 80 },
    ]);
  });

  it('suggests own exercise names first, then the built-in list, and last values', () => {
    const sessions = [
      s('2026-11-01', { exercises: [{ name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 55 }] }),
      s('2026-11-05', {
        exercises: [
          { name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 },
          { name: 'Seilspringen' },
        ],
      }),
    ];
    expect(exerciseSuggestions(sessions, ['Kniebeuge', 'bankdrücken'])).toEqual([
      'Bankdrücken',
      'Seilspringen',
      'Kniebeuge',
    ]);
    expect(lastOf(sessions, 'bankdrücken')?.weightKg).toBe(60);
    expect(lastOf(sessions, 'Plank')).toBeUndefined();
  });

  it('repeats the latest session for today without note and time', () => {
    const a = {
      date: '2026-11-05',
      time: '18:00',
      title: 'Oberkörper',
      note: 'x',
      durationMin: 50,
      exercises: [{ name: 'Rudern', sets: 3 }],
    };
    const b = { date: '2026-11-05', time: '07:00', exercises: [] };
    expect(latestSession([b, a])).toBe(a);
    expect(repeatSession(a, '2026-11-08')).toEqual({
      date: '2026-11-08',
      title: 'Oberkörper',
      durationMin: 50,
      exercises: [{ name: 'Rudern', sets: 3 }],
    });
  });

  it('groups by day, newest first', () => {
    expect(
      byDay([s('2026-11-01'), s('2026-11-03'), s('2026-11-01')]).map(([d, l]) => [d, l.length]),
    ).toEqual([
      ['2026-11-03', 1],
      ['2026-11-01', 2],
    ]);
  });
});

describe('kcal goal estimate (Mifflin-St Jeor × activity)', () => {
  it('matches hand-computed reference values, rounded to 50', () => {
    // 10·80 + 6.25·180 − 5·30 + 5 = 1780; × 1.55 = 2759 → 2750
    expect(
      estimateKcal({ weightKg: 80, heightCm: 180, age: 30, sex: 'male', activity: 'moderate' }),
    ).toBe(2750);
    // 10·60 + 6.25·165 − 5·30 − 161 = 1320.25; × 1.2 = 1584.3 → 1600
    expect(
      estimateKcal({ weightKg: 60, heightCm: 165, age: 30, sex: 'female', activity: 'sitting' }),
    ).toBe(1600);
    // "keine Angabe" sits between the two (−78)
    const none = estimateKcal({
      weightKg: 70,
      heightCm: 172,
      age: 40,
      sex: 'none',
      activity: 'light',
    })!;
    const m = estimateKcal({
      weightKg: 70,
      heightCm: 172,
      age: 40,
      sex: 'male',
      activity: 'light',
    })!;
    const f = estimateKcal({
      weightKg: 70,
      heightCm: 172,
      age: 40,
      sex: 'female',
      activity: 'light',
    })!;
    expect(none).toBeGreaterThan(f);
    expect(none).toBeLessThan(m);
  });

  it('gives no estimate outside adult ranges or for missing input', () => {
    const base = {
      weightKg: 70,
      heightCm: 172,
      age: 40,
      sex: 'none' as const,
      activity: 'light' as const,
    };
    expect(estimateKcal({ ...base, age: 15 })).toBeUndefined();
    expect(estimateKcal({ ...base, weightKg: Number.NaN })).toBeUndefined();
    expect(estimateKcal({ ...base, heightCm: 0 })).toBeUndefined();
  });
});
