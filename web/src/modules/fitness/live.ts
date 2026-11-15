/**
 * „Einheit starten“ (deep package 2): one exercise at a time, „Satz fertig“, an optional rest timer.
 * The state is a plain object; the page writes the session after every set, and keeps this state
 * device-local (localStorage, never synced) so a reload or an app switch picks up where it was.
 */
import type { Exercise, Session, WorkSet } from './schema';
import { withLog } from './sets';

export interface LiveState {
  /** Set once the first set is saved (nothing is written before that). */
  sessionId?: string;
  date: string;
  /** HH:mm the session started. */
  time: string;
  /** Epoch ms of the start (the session's duration at the end). */
  startedAt: number;
  title?: string;
  exercises: Exercise[];
  /** The exercise on screen. */
  index: number;
  /** Epoch ms the running rest ends; none = no rest running. */
  restUntil?: number;
}

/** A start from nothing, a template or a planned session: its exercises without old set logs. */
export function startLive(
  from: Pick<Session, 'title' | 'exercises'> | undefined,
  at: { date: string; time: string; now: number },
  sessionId?: string,
): LiveState {
  return {
    ...(sessionId ? { sessionId } : {}),
    date: at.date,
    time: at.time,
    startedAt: at.now,
    ...(from?.title ? { title: from.title } : {}),
    exercises: (from?.exercises ?? []).map(({ log: _l, ...e }) => e),
    index: 0,
  };
}

/** The partner exercise of a superset pair, if `index` is in one. */
function partner(exercises: readonly Exercise[], index: number): number | undefined {
  if (exercises[index]?.superset && index + 1 < exercises.length) return index + 1;
  if (index > 0 && exercises[index - 1]?.superset) return index - 1;
  return undefined;
}

/**
 * „Satz fertig“: the set goes into the exercise's log. In a superset the next set is the partner's,
 * without rest after the first of the pair; otherwise the same exercise again after the rest.
 */
export function finishSet(
  state: LiveState,
  set: WorkSet,
  at: { now: number; restSec: number },
): LiveState {
  const ex = state.exercises[state.index];
  if (!ex || (ex.log?.length ?? 0) >= MAX_SETS) return state;
  const exercises = state.exercises.map((e, i) =>
    i === state.index ? withLog(e, [...(e.log ?? []), set]) : e,
  );
  const other = partner(exercises, state.index);
  const firstOfPair = other !== undefined && other > state.index;
  const index = other ?? state.index;
  const rest = !firstOfPair && at.restSec > 0 ? { restUntil: at.now + at.restSec * 1000 } : {};
  const { restUntil: _r, ...base } = state;
  return { ...base, exercises, index, ...rest };
}

/** The values to offer for the next set: the last set of this exercise, else last time's values. */
export function nextSetDraft(e: Exercise | undefined, last: Exercise | undefined): WorkSet {
  const prev = e?.log?.filter((s) => !s.warmup).at(-1) ?? e?.log?.at(-1);
  const from = prev ?? last?.log?.find((s) => !s.warmup) ?? last;
  return {
    ...(from?.reps ? { reps: from.reps } : {}),
    ...(from?.weightKg !== undefined ? { weightKg: from.weightKg } : {}),
  };
}

/** Most exercises in a session and sets per exercise (the schema's limits). */
export const MAX_EXERCISES = 30;
export const MAX_SETS = 50;

/**
 * The session as it stands: only the exercises with at least one set done (a plan's other rows are not
 * logged as done), the minutes since the start (at least one).
 */
export function liveSession(state: LiveState, now: number): Session {
  const minutes = Math.round((now - state.startedAt) / 60_000);
  return {
    date: state.date,
    time: state.time,
    ...(state.title ? { title: state.title } : {}),
    exercises: state.exercises.filter((e) => e.name.trim() && e.log?.length),
    durationMin: Math.min(1440, Math.max(1, minutes)),
  };
}

/** Seconds of rest left (0 when none runs or it is over). */
export const restLeft = (state: LiveState, now: number): number =>
  state.restUntil ? Math.max(0, Math.ceil((state.restUntil - now) / 1000)) : 0;

const KEY = 'tm-fitness-live';

/** The stored live state of this device, or undefined (storage blocked or nothing running). */
export function loadLive(): LiveState | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as LiveState;
    return v && typeof v.date === 'string' && Array.isArray(v.exercises) ? v : undefined;
  } catch {
    return undefined;
  }
}

export function saveLive(state: LiveState | undefined): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the session itself is saved after every set anyway.
  }
}
