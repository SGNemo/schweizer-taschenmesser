import { useLiveQuery } from 'dexie-react-hooks';
import type { Stored } from '@/core/db/types';
import { formatMinutes, formatNumber } from '@/core/i18n/format';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { mealRepo, sessionRepo } from './repo';
import type { Exercise, Meal, Session } from './schema';
import { DEFAULTS, settingsSchema, type FitnessSettings } from './settings';

/** Sessions from `from` on (newest first); `undefined` while loading. */
export function useSessions(from?: string): Stored<Session>[] | undefined {
  return useLiveQuery(async () => {
    const all = await sessionRepo.active().toArray();
    return all
      .filter((s) => !from || s.date >= from)
      .sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`));
  }, [from]);
}

/** Meals from `from` on (newest first); `undefined` while loading. */
export function useMeals(from?: string): Stored<Meal>[] | undefined {
  return useLiveQuery(async () => {
    const all = await mealRepo.active().toArray();
    return all
      .filter((m) => !from || m.date >= from)
      .sort((a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`));
  }, [from]);
}

/** The module's settings with defaults filled in. */
export function useFitnessSettings(): FitnessSettings {
  const [values] = useSettings('module.fitness', settingsSchema, DEFAULTS);
  return { ...DEFAULTS, ...(values as Partial<FitnessSettings> | undefined) };
}

/** The built-in exercise names in the UI language. */
export const builtInExercises = (): string[] => Object.values(t.fitness.builtIn);

/** "3 × 8 · 60 kg" / "30 Min" for one exercise (without its name). */
export function exerciseDetail(e: Exercise): string {
  const parts: string[] = [];
  if (e.sets && e.reps) parts.push(t.fitness.line.setsReps(e.sets, e.reps));
  else if (e.sets) parts.push(t.fitness.line.sets(e.sets));
  else if (e.reps) parts.push(t.fitness.line.reps(e.reps));
  if (e.weightKg !== undefined) parts.push(t.fitness.line.weight(formatNumber(e.weightKg)));
  if (e.durationMin) parts.push(formatMinutes(e.durationMin));
  return parts.join(' · ');
}

/** Title of a session: its own, else its exercise names, else "Einheit". */
export function sessionTitle(s: Pick<Session, 'title' | 'exercises'>): string {
  if (s.title?.trim()) return s.title.trim();
  const names = s.exercises.map((e) => e.name);
  return names.length
    ? names.slice(0, 3).join(', ') + (names.length > 3 ? ' …' : '')
    : t.fitness.untitled;
}

export const kcalText = (n: number): string => formatNumber(n);
