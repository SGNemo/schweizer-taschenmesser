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
    const kcal = num(r['calories']);
    if (kcal === undefined) {
      empty++;
      continue;
    }
    const p = num(r['protein (g)']);
    const c = num(r['carbohydrates (g)']);
    const f = num(r['fat (g)']);
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

/**
 * All exercise rows of one day become one session (MFP has no workouts, only a day's list). The title is
 * the exercise's name when the day has one, else empty (the app shows its own word for an untitled one).
 */
export function parseMfpExercise(text: string): {
  workouts: ParsedWorkout[];
  unreadable: number;
  empty: number;
} {
  const byDay = new Map<string, { names: Set<string>; minutes: number; w: ParsedWorkout }>();
  let unreadable = 0;
  let empty = 0;
  for (const r of csvRecords(text)) {
    const day = isoDateTime(r['date'] ?? '');
    const exercise = r['exercise'];
    if (!day || !exercise) {
      unreadable++;
      continue;
    }
    const minutes = num(r['exercise minutes']);
    const sets = num(r['sets']);
    if (ADJUSTMENT.test(exercise) || (!(minutes && minutes > 0) && !(sets && sets > 0))) {
      empty++;
      continue;
    }
    let d = byDay.get(day.date);
    if (!d) {
      d = { names: new Set(), minutes: 0, w: { date: day.date, title: '', sets: [] } };
      byDay.set(day.date, d);
    }
    d.names.add(exercise);
    if (sets && sets > 0) {
      const reps = num(r['reps per set']);
      const kg = num(r['kilograms']);
      const lbs = num(r['pounds']);
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
      // Minutes of a cardio row belong to its exercise; one entry carries them all.
      if (!(sets && sets > 0)) d.w.sets.push({ exercise, seconds: minutes * 60 });
    }
  }
  const workouts = [...byDay.values()].map(({ names, minutes, w }) => ({
    ...w,
    title: names.size === 1 ? [...names][0]! : '',
    ...(minutes > 0 ? { durationMin: Math.round(minutes) } : {}),
  }));
  return { workouts, unreadable, empty };
}
