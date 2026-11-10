import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import runtime, { toExercises } from '../importer';
import { mealRepo, sessionRepo } from '../repo';
import { mealSchema, sessionSchema } from '../schema';

const fixture = (n: string) =>
  readFileSync(resolve(process.cwd(), 'src/importers/__fixtures__', n), 'utf8');
const file = (name: string) => ({ kind: 'file' as const, fileName: name, text: fixture(name) });
const parse = async (name: string) => runtime.parse('file', file(name), {} as never);

describe('fitness import runtime', () => {
  beforeEach(async () => {
    await db.table('fitness_session').clear();
    await db.table('fitness_meal').clear();
  });

  it('makes one exercise per name: sets, the heaviest weight with its reps, seconds as minutes', () => {
    expect(
      toExercises([
        { exercise: 'Bankdrücken', weightKg: 50, reps: 10 },
        { exercise: 'Bankdrücken', weightKg: 60, reps: 8 },
        { exercise: 'Plank', seconds: 60 },
        { exercise: 'Plank', seconds: 90 },
        { exercise: 'Bankdrücken', weightKg: 60, reps: 7 },
      ]),
    ).toEqual([
      { name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 },
      { name: 'Plank', sets: 2, durationMin: 3 },
    ]);
  });

  it('turns Strong and Hevy workouts into valid sessions', async () => {
    const strong = await parse('strong.csv');
    const hevy = await parse('hevy.csv');
    const all = [...strong.candidates, ...hevy.candidates];
    expect(all.map((c) => [c.collection, c.label])).toEqual([
      ['session', 'Oberkörper'],
      ['session', 'Laufen'],
      ['session', 'Beine'],
    ]);
    for (const c of all) expect(sessionSchema.safeParse(c.data).success, c.label).toBe(true);
    expect(all[0]!.data.exercises).toEqual([
      { name: 'Bankdrücken (Langhantel)', sets: 3, reps: 8, weightKg: 60 },
      { name: 'Rudern (Kabel)', sets: 1, reps: 10, weightKg: 45 },
    ]);
  });

  it('turns Cronometer food into valid meals; two equal coffees stay two', async () => {
    const r = await parse('cronometer.csv');
    expect(r.candidates).toHaveLength(4);
    for (const c of r.candidates) expect(mealSchema.safeParse(c.data).success, c.label).toBe(true);
    const keys = r.candidates.map((c) => c.dedupeKey);
    expect(new Set(keys).size).toBe(4);
    expect(r.skipped).toEqual({ empty: 1 });
  });

  it('knows what is already stored, so a second import adds nothing', async () => {
    const meals = await parse('cronometer.csv');
    for (const c of meals.candidates) await mealRepo.create(c.data as never);
    const sessions = await parse('strong.csv');
    for (const c of sessions.candidates) await sessionRepo.create(c.data as never);
    const storedMeals = await runtime.existingKeys('meal');
    const storedSessions = await runtime.existingKeys('session');
    expect(meals.candidates.every((c) => storedMeals.has(c.dedupeKey))).toBe(true);
    expect(sessions.candidates.every((c) => storedSessions.has(c.dedupeKey))).toBe(true);
  });

  it('counts a CSV it does not know instead of guessing', async () => {
    const r = await runtime.parse(
      'file',
      { kind: 'file', fileName: 'x.csv', text: 'a,b\n1,2\n' },
      {} as never,
    );
    expect(r.candidates).toEqual([]);
    expect(r.skipped).toEqual({ unsupported: 1 });
  });

  it('turns a MyFitnessPal export into sessions and meals; body measurements are not read', async () => {
    const r = await runtime.parse(
      'file',
      {
        kind: 'file',
        fileName: 'File-Export.zip',
        text: '',
        files: [
          { name: 'File-Export.zip/Nutrition-Summary.csv', text: fixture('mfp-nutrition.csv') },
          { name: 'File-Export.zip/Exercise-Summary.csv', text: fixture('mfp-exercise.csv') },
          {
            name: 'File-Export.zip/Measurement-Summary.csv',
            text: 'Date,Body Fat %,Weight\n2026-10-14,18.5,80.0\n',
          },
        ],
      },
      {} as never,
    );
    const sessions = r.candidates.filter((c) => c.collection === 'session');
    const meals = r.candidates.filter((c) => c.collection === 'meal');
    expect([sessions.length, meals.length]).toEqual([2, 4]);
    for (const c of sessions) expect(sessionSchema.safeParse(c.data).success, c.label).toBe(true);
    for (const c of meals) expect(mealSchema.safeParse(c.data).success, c.label).toBe(true);
    // A run is minutes, not "1 set"; every MFP day has the same fixed title.
    expect(sessions[0]!.data.exercises).toEqual([
      { name: 'Running (jogging), 10 km/h', durationMin: 35 },
    ]);
    expect(sessions.map((c) => c.data.title)).toEqual(['MyFitnessPal', 'MyFitnessPal']);
    expect(sessions[1]!.data.exercises).toEqual([
      { name: 'Bench Press, Barbell', sets: 3, reps: 8, weightKg: 61.2 },
      { name: 'Squats, Barbell', sets: 4, reps: 6, weightKg: 83.9 },
      { name: 'Walking, 5 km/h', durationMin: 20 },
    ]);
    expect(JSON.stringify(r.candidates)).not.toMatch(/80\.0|18\.5|Body Fat|Weight/);
    expect(r.skipped).toEqual({ empty: 2, unsupported: 1 });
  });

  it('finds a MyFitnessPal day again after an exercise was added to it in MFP', async () => {
    const one =
      'Date,Exercise,Type,Exercise Calories,Exercise Minutes,Sets,Reps Per Set,Kilograms,Steps,Note\n2026-10-15,Running,Cardio,300.0,30,,,,,\n';
    const first = await runtime.parse(
      'file',
      { kind: 'file', fileName: 'e.csv', text: one },
      {} as never,
    );
    for (const c of first.candidates) await sessionRepo.create(c.data as never);
    const again = await runtime.parse(
      'file',
      {
        kind: 'file',
        fileName: 'e.csv',
        text: one + '2026-10-15,"Squats, Barbell",Strength,,,3,5,80.0,,\n',
      },
      {} as never,
    );
    const stored = await runtime.existingKeys('session');
    expect(again.candidates.map((c) => stored.has(c.dedupeKey))).toEqual([true]);
  });

  it('two cardio rows of one exercise on a day are minutes, not sets', async () => {
    const r = await parse('mfp-exercise-kg.csv');
    expect(r.candidates.map((c) => c.data.exercises)).toEqual([
      [{ name: 'Rowing', durationMin: 35 }],
    ]);
  });
});
