/** Pure timer arithmetic; the engine feeds it the current time. */
import { pad2 } from '@/core/time/now';

export interface Countdown {
  durationMs: number;
  /** Epoch ms the countdown reaches zero while running. */
  endAt?: number;
  /** Time left while stopped/paused. */
  leftMs: number;
}

export const newCountdown = (durationMs: number): Countdown => ({ durationMs, leftMs: durationMs });
export const isRunning = (c: Countdown): boolean => c.endAt !== undefined;
export const left = (c: Countdown, now: number): number =>
  c.endAt === undefined ? c.leftMs : Math.max(0, c.endAt - now);

export function startCountdown(c: Countdown, now: number): Countdown {
  if (isRunning(c)) return c;
  const ms = c.leftMs > 0 ? c.leftMs : c.durationMs;
  return { ...c, endAt: now + ms, leftMs: ms };
}

export function pauseCountdown(c: Countdown, now: number): Countdown {
  return isRunning(c) ? { ...c, endAt: undefined, leftMs: left(c, now) } : c;
}

export const resetCountdown = (c: Countdown, durationMs = c.durationMs): Countdown =>
  newCountdown(durationMs);

export const finished = (c: Countdown, now: number): boolean => isRunning(c) && left(c, now) === 0;

export interface Stopwatch {
  startedAt?: number;
  /** Time accumulated before the current run. */
  elapsedMs: number;
  /** Lap totals, newest last. */
  laps: number[];
}

export const newStopwatch = (): Stopwatch => ({ elapsedMs: 0, laps: [] });
export const elapsed = (s: Stopwatch, now: number): number =>
  s.elapsedMs + (s.startedAt === undefined ? 0 : Math.max(0, now - s.startedAt));

export const startStopwatch = (s: Stopwatch, now: number): Stopwatch =>
  s.startedAt === undefined ? { ...s, startedAt: now } : s;
export const pauseStopwatch = (s: Stopwatch, now: number): Stopwatch =>
  s.startedAt === undefined ? s : { ...s, startedAt: undefined, elapsedMs: elapsed(s, now) };
export const lapStopwatch = (s: Stopwatch, now: number): Stopwatch =>
  s.startedAt === undefined ? s : { ...s, laps: [...s.laps, elapsed(s, now)] };

export type Phase = 'work' | 'rest';
export const POMODORO_MS: Record<Phase, number> = { work: 25 * 60_000, rest: 5 * 60_000 };

/** The phase after `phase`; a finished work phase completes a round. */
export const nextPhase = (phase: Phase, round: number): { phase: Phase; round: number } =>
  phase === 'work' ? { phase: 'rest', round } : { phase: 'work', round: round + 1 };

/** "mm:ss" (or "h:mm:ss") for a duration; the countdown rounds up so it never shows 00:00 early. */
export function clock(ms: number, up = false): string {
  const total = Math.max(0, up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
