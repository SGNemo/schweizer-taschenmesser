/**
 * Loop protection and limits. Pure: the state comes in and goes out, `state.ts` stores it. A rule
 * does not run when it is already part of the chain that caused the event, when the chain is too
 * deep, when it has already run for this occurrence, or when it ran too often this hour.
 */
import { MAX_DEPTH, type AutomationEvent, type Rule } from './types';

export const HOUR_MS = 3_600_000;
const OCCURRENCE_KEEP_MS = 30 * 24 * HOUR_MS;

export interface GuardState {
  /** Start times of runs per rule, last hour only. */
  runs: Record<string, number[]>;
  /** `<ruleId>|<key>` → when it ran. */
  seen: Record<string, number>;
}

export const emptyGuard = (): GuardState => ({ runs: {}, seen: {} });

export type Refusal = 'loop' | 'depth' | 'duplicate' | 'limit' | 'global-limit';

export function checkGuards(
  rule: Pick<Rule, 'id' | 'limitPerHour'>,
  event: AutomationEvent,
  state: GuardState,
  at: number,
  globalPerHour: number,
): Refusal | undefined {
  if (event.cause?.ruleIds.includes(rule.id)) return 'loop';
  if ((event.cause?.depth ?? 0) >= MAX_DEPTH) return 'depth';
  if (`${rule.id}|${event.key}` in state.seen) return 'duplicate';
  const recent = (state.runs[rule.id] ?? []).filter((t) => t > at - HOUR_MS);
  if (recent.length >= rule.limitPerHour) return 'limit';
  if (globalPerHour > 0) {
    const all = Object.values(state.runs).reduce(
      (n, list) => n + list.filter((t) => t > at - HOUR_MS).length,
      0,
    );
    if (all >= globalPerHour) return 'global-limit';
  }
  return undefined;
}

/** Records a run (also a dry run counts for the duplicate guard, but not for the hourly limits). */
export function recordRun(
  state: GuardState,
  ruleId: string,
  key: string,
  at: number,
  counts: boolean,
): GuardState {
  const runs = { ...state.runs };
  if (counts) runs[ruleId] = [...(runs[ruleId] ?? []).filter((t) => t > at - HOUR_MS), at];
  return { runs, seen: { ...state.seen, [`${ruleId}|${key}`]: at } };
}

/** Drops what is too old to matter. */
export function pruneGuard(state: GuardState, at: number): GuardState {
  const runs: GuardState['runs'] = {};
  for (const [id, list] of Object.entries(state.runs)) {
    const keep = list.filter((t) => t > at - HOUR_MS);
    if (keep.length > 0) runs[id] = keep;
  }
  const seen = Object.fromEntries(
    Object.entries(state.seen).filter(([, t]) => t > at - OCCURRENCE_KEEP_MS),
  );
  return { runs, seen };
}
