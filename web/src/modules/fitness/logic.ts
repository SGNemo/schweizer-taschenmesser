import { addDaysStr, startOfWeekStr } from '@/core/time/dates';
import type { Exercise, Meal, Session, Template } from './schema';

/** Pure calculations of the fitness module (no clock, no database). */

/** Days `from`…`to` of the week that holds `day` (inclusive). */
export function weekOf(day: string, weekStart: 1 | 7 = 1): { from: string; to: string } {
  const from = startOfWeekStr(day, weekStart);
  return { from, to: addDaysStr(from, 6) };
}

/** Minutes of a session: its own duration, else the sum of the exercises' durations. */
export function sessionMinutes(s: Pick<Session, 'durationMin' | 'exercises'>): number {
  if (s.durationMin) return s.durationMin;
  return s.exercises.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);
}

/** A session that happened (a planned one is not counted anywhere until it is done). */
export const isLogged = (s: Pick<Session, 'planned'>): boolean => !s.planned;

/** Logged sessions and minutes inside a date range. */
export function weekSummary(
  sessions: readonly Pick<Session, 'date' | 'durationMin' | 'exercises' | 'planned'>[],
  range: { from: string; to: string },
): { count: number; minutes: number } {
  const inside = sessions.filter((s) => isLogged(s) && s.date >= range.from && s.date <= range.to);
  return { count: inside.length, minutes: inside.reduce((m, s) => m + sessionMinutes(s), 0) };
}

/** kcal eaten on one day. */
export function daySum(meals: readonly Pick<Meal, 'date' | 'kcal'>[], day: string): number {
  return meals.reduce((sum, m) => (m.date === day ? sum + m.kcal : sum), 0);
}

const key = (s: string) => s.trim().toLocaleLowerCase();

/**
 * Food memory from the user's own meals: one entry per text (case-insensitive), with the kcal of the
 * latest meal of that text, most recent first. Local only, no external database.
 */
export function foodSuggestions(
  meals: readonly Pick<Meal, 'text' | 'kcal' | 'date' | 'time'>[],
  limit = 30,
): { text: string; kcal: number }[] {
  const sorted = [...meals].sort((a, b) =>
    `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`),
  );
  const seen = new Map<string, { text: string; kcal: number }>();
  for (const m of sorted)
    if (!seen.has(key(m.text))) seen.set(key(m.text), { text: m.text.trim(), kcal: m.kcal });
  return [...seen.values()].slice(0, limit);
}

/** Exercise names: own ones first (latest first), then the built-in starter list, no duplicates. */
export function exerciseSuggestions(
  sessions: readonly Pick<Session, 'date' | 'exercises'>[],
  builtIn: readonly string[],
): string[] {
  const out = new Map<string, string>();
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted)
    for (const e of s.exercises) if (!out.has(key(e.name))) out.set(key(e.name), e.name.trim());
  for (const n of builtIn) if (!out.has(key(n))) out.set(key(n), n);
  return [...out.values()];
}

/** The last time an exercise was done (for prefilling sets/reps/weight), or undefined. */
export function lastOf(
  sessions: readonly Pick<Session, 'date' | 'exercises' | 'planned'>[],
  name: string,
): Exercise | undefined {
  // What was done, never what is only planned.
  const sorted = [...sessions].filter(isLogged).sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const hit = s.exercises.find((e) => key(e.name) === key(name));
    if (hit) return hit;
  }
  return undefined;
}

/** The latest logged session (by date, then time) – the source of "Wie letztes Mal". */
export function latestSession<T extends Pick<Session, 'date' | 'time' | 'planned'>>(
  sessions: readonly T[],
): T | undefined {
  return [...sessions]
    .filter(isLogged)
    .sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`))[0];
}

/** A copy of a session for `day` (same exercises, title and duration; no note, no time). */
export function repeatSession(s: Session, day: string): Session {
  return {
    date: day,
    exercises: s.exercises.map((e) => ({ ...e })),
    ...(s.title ? { title: s.title } : {}),
    ...(s.durationMin ? { durationMin: s.durationMin } : {}),
  };
}

/** Group items by date, newest day first; items inside keep their given order. */
export function byDay<T extends { date: string }>(items: readonly T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const i of items) map.set(i.date, [...(map.get(i.date) ?? []), i]);
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

/** One day of the week view: logged sessions, their minutes, planned sessions and kcal. */
export interface WeekDay {
  date: string;
  sessions: number;
  minutes: number;
  planned: number;
  kcal: number;
  meals: number;
}

/** The seven days `from`…`from + 6` with plain sums (no averages, no judgement). */
export function weekDays(
  from: string,
  sessions: readonly Pick<Session, 'date' | 'durationMin' | 'exercises' | 'planned'>[],
  meals: readonly Pick<Meal, 'date' | 'kcal'>[],
  /** Plans are shown from this day on; a past day never lists what was not done. */
  today: string,
): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysStr(from, i);
    const own = sessions.filter((s) => s.date === date);
    const logged = own.filter(isLogged);
    const dayMeals = meals.filter((m) => m.date === date);
    return {
      date,
      sessions: logged.length,
      minutes: logged.reduce((m, s) => m + sessionMinutes(s), 0),
      planned: date >= today ? own.length - logged.length : 0,
      kcal: daySum(dayMeals, date),
      meals: dayMeals.length,
    };
  });
}

/** A template from a session (title, duration, exercises; never date, time or note). */
export function toTemplate(s: Session, fallbackTitle: string): Template {
  return {
    title: s.title?.trim() || fallbackTitle,
    exercises: s.exercises.map((e) => ({ ...e })),
    ...(s.durationMin ? { durationMin: s.durationMin } : {}),
  };
}

/**
 * „Erledigt“ on a planned session, from the list or from the planner: it counts on the day it was done –
 * today –, whatever day it was planned for.
 */
export const doneToday = (day: string): Pick<Session, 'planned' | 'date'> => ({
  planned: undefined,
  date: day,
});

/** A plan that is still ahead (today or later) vs. one whose day has passed („Wartet noch“). */
export const isAhead = (s: Pick<Session, 'date'>, day: string): boolean => s.date >= day;
