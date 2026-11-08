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
      w = { ...when, title, durationMin: durationMinutes(r['duration']), sets: [] };
      byKey.set(key, w);
    }
    const lbs = /lb/i.test(r['weight unit'] ?? '');
    const weight = num(r['weight']);
    w.sets.push({
      exercise,
      ...(weight ? { weightKg: lbs ? weight * LB_TO_KG : weight } : {}),
      ...(num(r['reps']) ? { reps: num(r['reps']) } : {}),
      ...(num(r['seconds']) ? { seconds: num(r['seconds']) } : {}),
    });
  }
  return { workouts: [...byKey.values()], unreadable };
}
