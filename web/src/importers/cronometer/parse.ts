/** Cronometer „Food & Recipe Entries“ CSV (servings): one row per food with its energy. Pure. */
import { csvHeader, csvRecords, isoDateTime, num, type ParsedMeal } from '../workouts';

export const looksLikeCronometer = (text: string): boolean => {
  const h = csvHeader(text);
  return h.includes('food name') && h.includes('energy (kcal)') && /(^|,|;)"?day"?(,|;)/.test(h);
};

const int = (v: number | undefined) => (v === undefined ? undefined : Math.round(v));

export function parseCronometer(text: string): {
  meals: ParsedMeal[];
  unreadable: number;
  empty: number;
} {
  const meals: ParsedMeal[] = [];
  let unreadable = 0;
  let empty = 0;
  for (const r of csvRecords(text)) {
    const day = isoDateTime(r['day'] ?? '');
    const name = r['food name'];
    const kcal = num(r['energy (kcal)']);
    if (!day || !name) {
      unreadable++;
      continue;
    }
    if (kcal === undefined) {
      empty++;
      continue;
    }
    const time = /^\d{1,2}:\d{2}/.exec(r['time'] ?? '')?.[0];
    meals.push({
      date: day.date,
      ...(time ? { time: time.padStart(5, '0') } : {}),
      text: name,
      kcal: Math.round(kcal),
      ...(num(r['protein (g)']) !== undefined ? { proteinG: int(num(r['protein (g)'])) } : {}),
      ...(num(r['carbs (g)']) !== undefined ? { carbsG: int(num(r['carbs (g)'])) } : {}),
      ...(num(r['fat (g)']) !== undefined ? { fatG: int(num(r['fat (g)'])) } : {}),
    });
  }
  return { meals, unreadable, empty };
}
