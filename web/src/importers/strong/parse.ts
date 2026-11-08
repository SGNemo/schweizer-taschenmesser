/** Strong (iOS/Android) „Export Strong Data“ CSV: one row per set; workouts by date + name. Pure. */
import {
  csvHeader,
  csvRecords,
  durationMinutes,
  isoDateTime,
  num,
  LB_TO_KG,
  type ParsedWorkout,
} from '../workouts';

export const looksLikeStrong = (text: string): boolean => {
  const h = csvHeader(text);
  return h.includes('workout name') && h.includes('exercise name') && h.includes('set order');
};

/**
 * The weight in kg from any of Strong's headers: „Weight (kg)“ / „Weight (lbs)“ (Strong 6), or „Weight“
 * with an optional „Weight Unit“ (older exports; without a unit column it is read as kg).
 */
function strongWeight(r: Record<string, string>): number | undefined {
  const kg = num(r['weight (kg)']);
  if (kg !== undefined) return kg;
  const lbs = num(r['weight (lbs)']);
  if (lbs !== undefined) return lbs * LB_TO_KG;
  const w = num(r['weight']);
  return w !== undefined && /lb/i.test(r['weight unit'] ?? '') ? w * LB_TO_KG : w;
}

/** „Duration“ / „Workout Duration“ („1h 5m“) or „Duration (sec)“ (Strong 6). */
function strongDuration(r: Record<string, string>): number | undefined {
  const sec = num(r['duration (sec)']);
  if (sec !== undefined) return sec > 0 ? Math.max(1, Math.round(sec / 60)) : undefined;
  return durationMinutes(r['duration'] ?? r['workout duration']);
}

export function parseStrong(text: string): { workouts: ParsedWorkout[]; unreadable: number } {
  const byKey = new Map<string, ParsedWorkout>();
  let unreadable = 0;
  for (const r of csvRecords(text)) {
    const when = isoDateTime(r['date'] ?? '');
    const exercise = r['exercise name'];
    if (!when || !exercise) {
      unreadable++;
      continue;
    }
    // Rest timers and notes are rows of their own in newer exports.
    if (/rest|note/i.test(r['set order'] ?? '')) continue;
    const title = r['workout name'] || exercise;
    const key = `${when.date} ${when.time ?? ''} ${title}`;
    let w = byKey.get(key);
    if (!w) {
      w = { ...when, title, durationMin: strongDuration(r), sets: [] };
      byKey.set(key, w);
    }
    const weightKg = strongWeight(r);
    w.sets.push({
      exercise,
      ...(weightKg ? { weightKg } : {}),
      ...(num(r['reps']) ? { reps: num(r['reps']) } : {}),
      ...(num(r['seconds']) ? { seconds: num(r['seconds']) } : {}),
    });
  }
  return { workouts: [...byKey.values()], unreadable };
}
