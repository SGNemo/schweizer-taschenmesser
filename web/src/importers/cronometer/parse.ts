/** Cronometer „Food & Recipe Entries“ CSV (servings): one row per food with its energy. Pure. */
import { csvHeader, csvRecords, isoDateTime, num, type ParsedMeal } from '../workouts';

export const looksLikeCronometer = (text: string): boolean => {
  const h = csvHeader(text);
  return h.includes('food name') && h.includes('energy (kcal)') && /(^|,|;)"?day"?(,|;)/.test(h);
};

/** „07:30“, „7:30 PM“ → „19:30“; anything else → no time (never a wrong one). */
export function clockTime(s: string | undefined): string | undefined {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(s?.trim() ?? '');
  if (!m) return undefined;
  let h = Number(m[1]);
  const half = m[3]?.toLowerCase();
  if (half) {
    if (h < 1 || h > 12) return undefined;
    h = (h % 12) + (half === 'pm' ? 12 : 0);
  }
  if (h > 23 || Number(m[2]) > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

const int = (v: number | undefined) =>
  v === undefined ? undefined : Math.min(999, Math.max(0, Math.round(v)));

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
    const time = clockTime(r['time']);
    meals.push({
      date: day.date,
      ...(time ? { time } : {}),
      text: name,
      kcal: Math.round(kcal),
      ...(num(r['protein (g)']) !== undefined ? { proteinG: int(num(r['protein (g)'])) } : {}),
      ...(num(r['carbs (g)']) !== undefined ? { carbsG: int(num(r['carbs (g)'])) } : {}),
      ...(num(r['fat (g)']) !== undefined ? { fatG: int(num(r['fat (g)'])) } : {}),
    });
  }
  return { meals, unreadable, empty };
}
