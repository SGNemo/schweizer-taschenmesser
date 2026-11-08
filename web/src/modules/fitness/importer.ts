/**
 * Import from other apps (package 3): Strong and Hevy workouts, Cronometer food. The parsers in
 * `importers/{strong,hevy,cronometer}` read the CSV; this runtime turns their rows into candidates for the
 * shared preview/commit/undo flow. Sets of one exercise become one exercise (number of sets, the
 * heaviest weight with its reps, seconds summed to minutes). Nothing leaves the device.
 */
import type { ImportCandidate, ImporterRuntime } from '@/core/importer/types';
import { formatNumber } from '@/core/i18n/format';
import { looksLikeCronometer, parseCronometer } from '@/importers/cronometer/parse';
import { looksLikeHevy, parseHevy } from '@/importers/hevy/parse';
import { skipNotes } from '@/importers/report';
import { looksLikeStrong, parseStrong } from '@/importers/strong/parse';
import { addSkip, type SkipCounts } from '@/importers/types';
import type { ParsedMeal, ParsedSet, ParsedWorkout } from '@/importers/workouts';
import { t } from '@/strings';
import { mealRepo, sessionRepo } from './repo';
import type { Exercise, Meal, Session } from './schema';

/** More rows than this in one import are left out (counted), the preview stays usable. */
export const MAX_CANDIDATES = 5000;

const clamp = (v: number | undefined, max: number, min = 1) =>
  v === undefined || !Number.isFinite(v) ? undefined : Math.min(max, Math.max(min, Math.round(v)));

/** The sets of one workout as exercises, in the order they first appear. */
export function toExercises(sets: readonly ParsedSet[]): Exercise[] {
  const byName = new Map<string, ParsedSet[]>();
  for (const s of sets) byName.set(s.exercise, [...(byName.get(s.exercise) ?? []), s]);
  return [...byName.entries()].slice(0, 30).map(([name, list]) => {
    const heaviest = list.reduce<ParsedSet | undefined>(
      (a, s) => ((s.weightKg ?? 0) > (a?.weightKg ?? 0) ? s : a),
      undefined,
    );
    const reps = heaviest?.reps ?? list.find((s) => s.reps)?.reps;
    const seconds = list.reduce((sum, s) => sum + (s.seconds ?? 0), 0);
    const kg = heaviest?.weightKg;
    const sets = clamp(list.length, 50);
    return {
      name: name.slice(0, 80),
      ...(sets ? { sets } : {}),
      ...(clamp(reps, 500) ? { reps: clamp(reps, 500) } : {}),
      ...(kg && kg > 0 ? { weightKg: Math.min(1000, Math.round(kg * 10) / 10) } : {}),
      ...(seconds > 0 ? { durationMin: clamp(seconds / 60, 1440) } : {}),
    };
  });
}

const sessionKey = (s: Pick<Session, 'date' | 'time' | 'title'>) =>
  `session:${s.date}|${s.time ?? ''}|${(s.title ?? '').trim().toLocaleLowerCase()}`;
const mealBase = (m: Pick<Meal, 'date' | 'time' | 'text' | 'kcal'>) =>
  `meal:${m.date}|${m.time ?? ''}|${m.text.trim().toLocaleLowerCase()}|${m.kcal}`;

/** Keys with an occurrence counter, so two equal coffees on one day stay two (and match again on a re-import). */
function numbered<T>(items: readonly T[], base: (x: T) => string): string[] {
  const seen = new Map<string, number>();
  return items.map((x) => {
    const b = base(x);
    const n = (seen.get(b) ?? 0) + 1;
    seen.set(b, n);
    return `${b}#${n}`;
  });
}

function sessionCandidate(w: ParsedWorkout): ImportCandidate {
  const exercises = toExercises(w.sets);
  const data: Session = {
    date: w.date,
    ...(w.time ? { time: w.time } : {}),
    title: w.title.slice(0, 80),
    ...(clamp(w.durationMin, 1440) ? { durationMin: clamp(w.durationMin, 1440) } : {}),
    exercises,
  };
  return {
    collection: 'session',
    data,
    label: data.title!,
    detail: [w.date, t.fitness.list.exercises(exercises.length)].join(' · '),
    dedupeKey: sessionKey(data),
  };
}

function mealCandidates(meals: readonly ParsedMeal[]): ImportCandidate[] {
  const rows = meals.map((m) => ({
    ...m,
    text: m.text.slice(0, 120),
    kcal: Math.min(9999, Math.max(0, m.kcal)),
  }));
  const keys = numbered(rows, mealBase);
  return rows.map((m, i) => ({
    collection: 'meal',
    data: m,
    label: m.text,
    detail: [m.date, m.time ?? '', t.fitness.line.kcal(formatNumber(m.kcal))]
      .filter(Boolean)
      .join(' · '),
    dedupeKey: keys[i]!,
  }));
}

const runtime: ImporterRuntime = {
  parse(_id, input) {
    const skipped: SkipCounts = {};
    const candidates: ImportCandidate[] = [];
    if (input.kind !== 'file') return { candidates, notes: [], skipped };
    for (const file of input.files ?? [{ name: input.fileName, text: input.text }]) {
      const text = file.text ?? '';
      if (looksLikeStrong(text) || looksLikeHevy(text)) {
        const r = looksLikeStrong(text) ? parseStrong(text) : parseHevy(text);
        addSkip(skipped, 'unreadable', r.unreadable);
        for (const w of r.workouts) {
          if (w.sets.length === 0) addSkip(skipped, 'empty');
          else candidates.push(sessionCandidate(w));
        }
      } else if (looksLikeCronometer(text)) {
        const r = parseCronometer(text);
        addSkip(skipped, 'unreadable', r.unreadable);
        addSkip(skipped, 'empty', r.empty);
        candidates.push(...mealCandidates(r.meals));
      } else addSkip(skipped, 'unsupported');
    }
    if (candidates.length > MAX_CANDIDATES) {
      addSkip(skipped, 'tooMany', candidates.length - MAX_CANDIDATES);
      candidates.length = MAX_CANDIDATES;
    }
    return { candidates, notes: skipNotes(skipped), skipped };
  },
  async existingKeys(collection) {
    if (collection === 'session') {
      // A plan is no workout yet: an imported workout on its day and with its title is still imported.
      const rows = (await sessionRepo.active().toArray()).filter((r) => !r.planned);
      return new Set(rows.map(sessionKey));
    }
    if (collection === 'meal') {
      const rows = (await mealRepo.active().toArray()).sort((a, b) => a.createdAt - b.createdAt);
      return new Set(numbered(rows, mealBase));
    }
    return new Set();
  },
};

export default runtime;
