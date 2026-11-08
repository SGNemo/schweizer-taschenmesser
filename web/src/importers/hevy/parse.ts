/** Hevy „Export Workouts“ CSV: one row per set; weights in kg or lbs by column. Pure. */
import {
  csvHeader,
  csvRecords,
  englishDateTime,
  num,
  LB_TO_KG,
  type ParsedWorkout,
} from '../workouts';

export const looksLikeHevy = (text: string): boolean => {
  const h = csvHeader(text);
  return h.includes('exercise_title') && h.includes('set_index') && h.includes('start_time');
};

const minutesBetween = (
  a?: { date: string; time?: string },
  b?: { date: string; time?: string },
) => {
  if (!a?.time || !b?.time) return undefined;
  const t = (x: { date: string; time?: string }) =>
    Date.UTC(
      Number(x.date.slice(0, 4)),
      Number(x.date.slice(5, 7)) - 1,
      Number(x.date.slice(8, 10)),
      Number(x.time!.slice(0, 2)),
      Number(x.time!.slice(3, 5)),
    );
  const min = Math.round((t(b) - t(a)) / 60000);
  return min > 0 && min <= 1440 ? min : undefined;
};

export function parseHevy(text: string): { workouts: ParsedWorkout[]; unreadable: number } {
  const byKey = new Map<string, ParsedWorkout>();
  let unreadable = 0;
  for (const r of csvRecords(text)) {
    const start = englishDateTime(r['start_time'] ?? '');
    const exercise = r['exercise_title'];
    if (!start || !exercise) {
      unreadable++;
      continue;
    }
    const title = r['title'] || exercise;
    const key = `${start.date} ${start.time ?? ''} ${title}`;
    let w = byKey.get(key);
    if (!w) {
      w = {
        ...start,
        title,
        durationMin: minutesBetween(start, englishDateTime(r['end_time'] ?? '')),
        sets: [],
      };
      byKey.set(key, w);
    }
    // Warm-up sets are part of the export; they are kept like any other set.
    const kg = num(r['weight_kg']);
    const lbs = num(r['weight_lbs']);
    const weightKg = kg ?? (lbs !== undefined ? lbs * LB_TO_KG : undefined);
    w.sets.push({
      exercise,
      ...(weightKg ? { weightKg } : {}),
      ...(num(r['reps']) ? { reps: num(r['reps']) } : {}),
      ...(num(r['duration_seconds']) ? { seconds: num(r['duration_seconds']) } : {}),
    });
  }
  return { workouts: [...byKey.values()], unreadable };
}
