/**
 * MyFitnessPal Premium export (a ZIP the import flow unpacks): `Nutrition-Summary-….csv` has one row per
 * meal of a day (Breakfast, Lunch …, as the user named them) with energy and macros, `Exercise-Summary-….csv`
 * one row per exercise (Cardio with minutes, Strength with sets × reps × Pounds or Kilograms).
 * `Measurement-Summary` (weight, body fat) is left alone on purpose: Fitness keeps no body data. Pure.
 */
import {
  csvHeader,
  csvRecords,
  isoDateTime,
  LB_TO_KG,
  num,
  type ParsedMeal,
  type ParsedWorkout,
} from '../workouts';

export const looksLikeMfpNutrition = (text: string): boolean => {
  const h = csvHeader(text);
  return (
    /^"?date"?,"?meal"?,"?calories"?,/.test(h) &&
    h.includes('protein (g)') &&
    h.includes('carbohydrates (g)')
  );
};

export const looksLikeMfpExercise = (text: string): boolean => {
  const h = csvHeader(text);
  return (
    /^"?date"?,"?exercise"?,"?type"?,/.test(h) &&
    h.includes('exercise minutes') &&
    h.includes('reps per set')
  );
};

/** MFP writes English numbers: „2,100“ is two thousand one hundred, never 2.1. */
export function mfpNum(s: string | undefined): number | undefined {
  const v = s?.trim() ?? '';
  return /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v) ? Number(v.replace(/,/g, '')) : num(v);
}

const int = (v: number | undefined) =>
  v === undefined ? undefined : Math.min(999, Math.max(0, Math.round(v)));

export function parseMfpNutrition(text: string): {
  meals: ParsedMeal[];
  unreadable: number;
  empty: number;
} {
  const meals: ParsedMeal[] = [];
  let unreadable = 0;
  let empty = 0;
  for (const r of csvRecords(text)) {
    const day = isoDateTime(r['date'] ?? '');
    const meal = r['meal'];
    if (!day || !meal) {
      unreadable++;
      continue;
    }
    const kcal = mfpNum(r['calories']);
    if (kcal === undefined) {
      empty++;
      continue;
    }
    const p = mfpNum(r['protein (g)']);
    const c = mfpNum(r['carbohydrates (g)']);
    const f = mfpNum(r['fat (g)']);
    meals.push({
      date: day.date,
      text: meal,
      kcal: Math.round(kcal),
      ...(p !== undefined ? { proteinG: int(p) } : {}),
      ...(c !== undefined ? { carbsG: int(c) } : {}),
      ...(f !== undefined ? { fatG: int(f) } : {}),
    });
  }
  return { meals, unreadable, empty };
}

/** Rows that only correct a calorie count elsewhere („MapMyFitness calorie adjustment“), not exercise. */
const ADJUSTMENT = /calorie adjustment/i;

/** Title of every imported MFP session: fixed and untranslated, so a re-import finds the day again. */
export const MFP_TITLE = 'MyFitnessPal';

/**
 * All exercise rows of one day become one session (MFP has no workouts, only a day's list), titled
 * `MFP_TITLE` whatever the day holds, so adding an exercise in MFP and exporting again matches the same day.
 * Cardio minutes of one exercise on one day are one entry (two runs are 1 run's worth of minutes, not 2 sets).
 */
export function parseMfpExercise(text: string): {
  workouts: ParsedWorkout[];
  unreadable: number;
  empty: number;
} {
  const byDay = new Map<string, { minutes: number; w: ParsedWorkout }>();
  let unreadable = 0;
  let empty = 0;
  for (const r of csvRecords(text)) {
    const day = isoDateTime(r['date'] ?? '');
    const exercise = r['exercise'];
    if (!day || !exercise) {
      unreadable++;
      continue;
    }
    const minutes = mfpNum(r['exercise minutes']);
    const sets = mfpNum(r['sets']);
    if (ADJUSTMENT.test(exercise) || (!(minutes && minutes > 0) && !(sets && sets > 0))) {
      empty++;
      continue;
    }
    let d = byDay.get(day.date);
    if (!d) {
      d = { minutes: 0, w: { date: day.date, title: MFP_TITLE, sets: [] } };
      byDay.set(day.date, d);
    }
    if (sets && sets > 0) {
      const reps = mfpNum(r['reps per set']);
      const kg = mfpNum(r['kilograms']);
      const lbs = mfpNum(r['pounds']);
      const weightKg = kg ?? (lbs !== undefined ? lbs * LB_TO_KG : undefined);
      for (let i = 0; i < Math.min(50, Math.round(sets)); i++) {
        d.w.sets.push({
          exercise,
          ...(reps && reps > 0 ? { reps } : {}),
          ...(weightKg && weightKg > 0 ? { weightKg } : {}),
        });
      }
    }
    if (minutes && minutes > 0) {
      d.minutes += minutes;
      if (!(sets && sets > 0)) {
        const same = d.w.sets.find((x) => x.exercise === exercise && x.seconds !== undefined);
        if (same) same.seconds = (same.seconds ?? 0) + minutes * 60;
        else d.w.sets.push({ exercise, seconds: minutes * 60 });
      }
    }
  }
  const workouts = [...byDay.values()].map(({ minutes, w }) => ({
    ...w,
    ...(minutes > 0 ? { durationMin: Math.round(minutes) } : {}),
  }));
  return { workouts, unreadable, empty };
}
