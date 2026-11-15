/**
 * Progress per exercise (deep package 1): history, last values and personal bests, and the sets per
 * muscle group of a week. Pure functions over logged sessions (a plan never counts); no clock, no
 * database. Bests are shown quietly as a fact – never a comparison that judges a session.
 */
import { groupOf, type Group } from './catalog';
import { isLogged } from './logic';
import { measuredSets } from './sets';
import type { Exercise, Session } from './schema';

type Logged = Pick<Session, 'date' | 'time' | 'exercises' | 'planned'>;

const key = (s: string) => s.trim().toLocaleLowerCase();

/** One time an exercise was done. */
export interface ExerciseEntry {
  date: string;
  exercise: Exercise;
}

/**
 * Every logged row of an exercise, newest first. A session can hold the same exercise twice (a top set
 * after the working sets): both rows count, in their order inside the session.
 */
export function exerciseHistory(sessions: readonly Logged[], name: string): ExerciseEntry[] {
  const k = key(name);
  return [...sessions]
    .filter(isLogged)
    .sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`))
    .flatMap((s) =>
      s.exercises.filter((e) => key(e.name) === k).map((exercise) => ({ date: s.date, exercise })),
    );
}

/** The last logged time of an exercise (the first row of the latest session), or undefined. */
export function lastEntry(sessions: readonly Logged[], name: string): ExerciseEntry | undefined {
  return exerciseHistory(sessions, name)[0];
}

/**
 * A personal best: the heaviest weight (with its reps), else – for an exercise without weight – the
 * most reps, else the longest duration. The earliest day that reached it counts (a tie is no new best).
 */
export type Best =
  | { kind: 'weight'; kg: number; reps?: number; date: string }
  | { kind: 'reps'; reps: number; date: string }
  | { kind: 'minutes'; minutes: number; date: string };

export function personalBest(history: readonly ExerciseEntry[]): Best | undefined {
  // Oldest first, so a tie keeps the day it was first reached.
  const old = [...history].reverse();
  let weight: Extract<Best, { kind: 'weight' }> | undefined;
  let reps: Extract<Best, { kind: 'reps' }> | undefined;
  let minutes: Extract<Best, { kind: 'minutes' }> | undefined;
  for (const { date, exercise: row } of old) {
    // A row logged set by set is measured per working set (warm-ups never set a best).
    for (const e of measuredSets(row)) {
      if (e.weightKg !== undefined && e.weightKg > 0) {
        const better =
          !weight ||
          e.weightKg > weight.kg ||
          (e.weightKg === weight.kg && (e.reps ?? 0) > (weight.reps ?? 0));
        if (better)
          weight = { kind: 'weight', kg: e.weightKg, ...(e.reps ? { reps: e.reps } : {}), date };
      } else if (e.reps && (!reps || e.reps > reps.reps))
        reps = { kind: 'reps', reps: e.reps, date };
    }
    if (row.durationMin && (!minutes || row.durationMin > minutes.minutes))
      minutes = { kind: 'minutes', minutes: row.durationMin, date };
  }
  return weight ?? reps ?? minutes;
}

/** One exercise of the „Übungen“ view. */
export interface ExerciseSummary {
  /** The name as written the last time. */
  name: string;
  group: Group | 'other';
  /** How many logged days hold it. */
  times: number;
  last: ExerciseEntry;
  best: Best | undefined;
}

/** Every exercise ever logged, latest first, with its last values and best. */
export function exerciseOverview(sessions: readonly Logged[]): ExerciseSummary[] {
  const names = new Map<string, string>();
  const sorted = [...sessions]
    .filter(isLogged)
    .sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`));
  for (const s of sorted)
    for (const e of s.exercises) if (!names.has(key(e.name))) names.set(key(e.name), e.name.trim());
  return [...names.values()].map((name) => {
    const history = exerciseHistory(sorted, name);
    return {
      name,
      group: groupOf(name),
      times: new Set(history.map((h) => h.date)).size,
      last: history[0]!,
      best: personalBest(history),
    };
  });
}

/** Does this entry set the best (same day and values)? Used to mark one row of the history. */
export function isBestEntry(entry: ExerciseEntry, best: Best | undefined): boolean {
  return !!best && entry.date === best.date && reachesBest(entry, best);
}

/** Do this entry's values equal the best (on any day)? The list then says „Bestwert“ instead of the numbers. */
export function reachesBest(entry: ExerciseEntry, best: Best | undefined): boolean {
  if (!best) return false;
  if (best.kind === 'minutes') return entry.exercise.durationMin === best.minutes;
  return measuredSets(entry.exercise).some((e) =>
    best.kind === 'weight'
      ? e.weightKg === best.kg && (e.reps ?? 0) === (best.reps ?? 0)
      : !(e.weightKg && e.weightKg > 0) && e.reps === best.reps,
  );
}

/** Sets (and minutes for exercises without sets) per muscle group inside a date range. */
export interface GroupLoad {
  group: Group | 'other';
  sets: number;
  minutes: number;
}

/**
 * The week by muscle group: sets of every logged exercise (an exercise with reps or a weight but no set
 * count is one set), minutes of the ones that only have a duration. Groups in catalogue order.
 */
export function loadByGroup(
  sessions: readonly Logged[],
  range: { from: string; to: string },
  order: readonly (Group | 'other')[],
): GroupLoad[] {
  const map = new Map<Group | 'other', GroupLoad>();
  for (const s of sessions) {
    if (!isLogged(s) || s.date < range.from || s.date > range.to) continue;
    for (const e of s.exercises) {
      const group = groupOf(e.name);
      const row = map.get(group) ?? { group, sets: 0, minutes: 0 };
      const sets = e.sets ?? (e.reps || e.weightKg !== undefined ? 1 : 0);
      row.sets += sets;
      if (!sets) row.minutes += e.durationMin ?? 0;
      map.set(group, row);
    }
  }
  return order.flatMap((g) => {
    const row = map.get(g);
    return row && (row.sets || row.minutes) ? [row] : [];
  });
}

/** One point per day of the measure the best uses (heaviest working weight, else most reps, else minutes). */
export interface TrendPoints {
  kind: Best['kind'];
  points: { date: string; value: number }[];
}

/**
 * The course of an exercise for a chart (deep package 4), oldest first: per day the heaviest working
 * weight (else the most reps, else the longest duration) – the same measure as the best. Days without
 * that measure are left out, never drawn as zero.
 */
export function trendOf(history: readonly ExerciseEntry[]): TrendPoints | undefined {
  const best = personalBest(history);
  if (!best) return undefined;
  const byDay = new Map<string, number>();
  for (const { date, exercise } of [...history].reverse()) {
    const values =
      best.kind === 'minutes'
        ? [exercise.durationMin ?? 0]
        : measuredSets(exercise).map((s) =>
            best.kind === 'weight' ? (s.weightKg ?? 0) : s.weightKg ? 0 : (s.reps ?? 0),
          );
    const v = Math.max(0, ...values);
    if (v > 0) byDay.set(date, Math.max(byDay.get(date) ?? 0, v));
  }
  return { kind: best.kind, points: [...byDay].map(([date, value]) => ({ date, value })) };
}
