import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clockTime, parseCronometer } from './cronometer/parse';
import { parseHevy } from './hevy/parse';
import { detectSources } from './registry';
import { parseStrong } from './strong/parse';
import { durationMinutes, englishDateTime, num } from './workouts';

const fixture = (n: string) =>
  readFileSync(resolve(process.cwd(), 'src/importers/__fixtures__', n), 'utf8');

describe('fitness exports (invented fixtures)', () => {
  it('recognises Strong, Hevy and Cronometer by their header, nothing else', () => {
    for (const [file, id] of [
      ['strong.csv', 'strong'],
      ['hevy.csv', 'hevy'],
      ['cronometer.csv', 'cronometer'],
    ] as const) {
      const found = detectSources([{ name: `export.csv`, text: fixture(file) }]);
      expect(found[0]?.source.id, file).toBe(id);
      expect(found[0]?.confidence).toBe(1);
    }
    expect(
      detectSources([{ name: 'x.csv', text: fixture('ticktick.csv') }])[0]?.source.id,
    ).not.toMatch(/strong|hevy|cronometer/);
  });

  it('reads Strong: workouts by date + name, rest timers left out, durations', () => {
    const { workouts, unreadable } = parseStrong(fixture('strong.csv'));
    expect(unreadable).toBe(0);
    expect(workouts.map((w) => [w.date, w.time, w.title, w.durationMin, w.sets.length])).toEqual([
      ['2026-10-12', '18:05', 'Oberkörper', 55, 4],
      ['2026-10-14', '07:30', 'Laufen', 65, 1],
    ]);
    expect(workouts[1]!.sets[0]).toEqual({ exercise: 'Laufen', seconds: 3900 });
  });

  it('reads Hevy: English dates, duration from start to end, decimal weights', () => {
    const { workouts } = parseHevy(fixture('hevy.csv'));
    expect(workouts).toHaveLength(1);
    expect(workouts[0]).toMatchObject({
      date: '2026-10-15',
      time: '17:00',
      title: 'Beine',
      durationMin: 50,
    });
    expect(workouts[0]!.sets.map((s) => s.weightKg)).toEqual([40, 70, 72.5, undefined, undefined]);
  });

  it('reads Cronometer: one meal per food, rounded kcal, rows without energy counted', () => {
    const { meals, empty } = parseCronometer(fixture('cronometer.csv'));
    expect(empty).toBe(1);
    expect(meals[0]).toEqual({
      date: '2026-10-12',
      time: '07:30',
      text: 'Haferflocken mit Obst',
      kcal: 350,
      proteinG: 10,
      carbsG: 60,
      fatG: 6,
    });
    expect(meals.map((m) => m.text)).toEqual([
      'Haferflocken mit Obst',
      'Kaffee mit Milch',
      'Kaffee mit Milch',
      'Nudeln mit Tomatensoße',
    ]);
  });

  it('reads the Strong 6 header: weight in kg or lbs by column, duration in seconds', () => {
    const text = [
      'Workout #,Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (lbs),Reps,RPE,Distance (meters),Seconds,Notes,Workout Notes',
      '7,2026-10-20 18:00:00,Push,3300,Bench Press,1,135,8,,,,,',
    ].join('\n');
    const { workouts } = parseStrong(text);
    expect(workouts[0]).toMatchObject({ date: '2026-10-20', title: 'Push', durationMin: 55 });
    expect(workouts[0]!.sets[0]!.weightKg).toBeCloseTo(61.2, 1);
    const kg = parseStrong(text.replace('Weight (lbs)', 'Weight (kg)').replace(',135,', ',60,'));
    expect(kg.workouts[0]!.sets[0]!.weightKg).toBe(60);
  });

  it('reads 12-hour times and never stores a time it does not understand', () => {
    expect(clockTime('7:30 PM')).toBe('19:30');
    expect(clockTime('12:15 AM')).toBe('00:15');
    expect(clockTime('12:15 PM')).toBe('12:15');
    expect(clockTime('07:30')).toBe('07:30');
    expect(clockTime('abends')).toBeUndefined();
    expect(clockTime('13:00 PM')).toBeUndefined();
  });

  it('reads thousands separators either way', () => {
    expect(num('1,234.5')).toBe(1234.5);
    expect(num('1.234,5')).toBe(1234.5);
    expect(num('62,5')).toBe(62.5);
  });

  it('understands the usual duration and date spellings', () => {
    expect(durationMinutes('1h 5m')).toBe(65);
    expect(durationMinutes('45m')).toBe(45);
    expect(durationMinutes('1:05:00')).toBe(65);
    expect(durationMinutes('45:30')).toBeUndefined();
    expect(durationMinutes('')).toBeUndefined();
    expect(englishDateTime('3 Nov 2026, 07:05')).toEqual({ date: '2026-11-03', time: '07:05' });
    expect(englishDateTime('Hallo')).toBeUndefined();
  });
});
