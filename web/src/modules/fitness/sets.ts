/**
 * Single sets (deep package 2): an exercise logged set by set keeps its summary (`sets`, `reps`,
 * `weightKg`) in step, so every reader that knows only the summary (lists, week, import dedupe,
 * „Wie letztes Mal“) stays right. Pure functions, no clock, no database.
 */
import type { Exercise, WorkSet } from './schema';

/** Sets that count: everything except warm-ups. */
export const workingSets = (log: readonly WorkSet[]): WorkSet[] => log.filter((s) => !s.warmup);

/**
 * The summary of a set log: number of working sets, the heaviest working weight with its reps (more reps
 * win a tie); without any weight the most reps. Warm-ups never count.
 */
export function summarize(log: readonly WorkSet[]): Pick<Exercise, 'sets' | 'reps' | 'weightKg'> {
  const work = workingSets(log);
  if (!work.length) return {};
  const weighted = work.filter((s) => s.weightKg !== undefined);
  const top = weighted.length
    ? weighted.reduce((a, b) =>
        b.weightKg! > a.weightKg! || (b.weightKg === a.weightKg && (b.reps ?? 0) > (a.reps ?? 0))
          ? b
          : a,
      )
    : work.reduce((a, b) => ((b.reps ?? 0) > (a.reps ?? 0) ? b : a));
  return {
    sets: work.length,
    ...(top.reps ? { reps: top.reps } : {}),
    ...(top.weightKg !== undefined ? { weightKg: top.weightKg } : {}),
  };
}

/** The exercise with this set log and a fresh summary (an empty log turns back into a plain row). */
export function withLog(e: Exercise, log: readonly WorkSet[]): Exercise {
  const { sets: _s, reps: _r, weightKg: _w, log: _l, ...rest } = e;
  return log.length ? { ...rest, ...summarize(log), log: [...log] } : rest;
}

/** „Sätze einzeln“ on a plain row: its summary as that many equal sets (at least one). */
export function logFromSummary(e: Exercise): WorkSet[] {
  const one: WorkSet = {
    ...(e.reps ? { reps: e.reps } : {}),
    ...(e.weightKg !== undefined ? { weightKg: e.weightKg } : {}),
  };
  return Array.from({ length: e.sets ?? 1 }, () => ({ ...one }));
}

/** The values a best is measured on: every working set of a logged row, else the row itself. */
export function measuredSets(e: Exercise): Pick<WorkSet, 'reps' | 'weightKg'>[] {
  return e.log ? workingSets(e.log) : [e];
}
