import { useLiveQuery } from 'dexie-react-hooks';
import { notDeleted } from '@/core/db/repo';
import type { Stored } from '@/core/db/types';
import { formatMinutes, formatNumber } from '@/core/i18n/format';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { mealRepo, sessionRepo, templateRepo } from './repo';
import type { Exercise, Meal, Session, Template } from './schema';
import { DEFAULTS, settingsSchema, type FitnessSettings } from './settings';

/** Sessions from `from` on (newest first); `undefined` while loading. */
export function useSessions(from?: string): Stored<Session>[] | undefined {
  return useLiveQuery(async () => {
    const all = from
      ? (await sessionRepo.table.where('date').aboveOrEqual(from).toArray()).filter(notDeleted)
      : await sessionRepo.active().toArray();
    return all.sort((a, b) =>
      `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`),
    );
  }, [from]);
}

/** Meals from `from` on (newest first); `undefined` while loading. */
export function useMeals(from?: string): Stored<Meal>[] | undefined {
  return useLiveQuery(async () => {
    const all = from
      ? (await mealRepo.table.where('date').aboveOrEqual(from).toArray()).filter(notDeleted)
      : await mealRepo.active().toArray();
    return all.sort((a, b) =>
      `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`),
    );
  }, [from]);
}

/** Saved templates by title (`undefined` while loading). */
export function useTemplates(): Stored<Template>[] | undefined {
  return useLiveQuery(
    async () =>
      (await templateRepo.active().toArray()).sort((a, b) => a.title.localeCompare(b.title)),
    [],
  );
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

/**
 * Today's kcal in words: "1.450 kcal von 2.200"; past the goal only "2.450 kcal · Ziel 2.200" – neutral,
 * never an overrun (no red, no "zu viel"). Without a goal just the sum.
 */
export function kcalLine(kcal: number, goal: number): string {
  const w = t.fitness.widget;
  if (!goal) return w.kcal(kcalText(kcal));
  return kcal > goal
    ? w.kcalPastGoal(kcalText(kcal), kcalText(goal))
    : w.kcalOf(kcalText(kcal), kcalText(goal));
}
