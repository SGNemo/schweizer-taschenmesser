/**
 * Pure arithmetic of a focus session (one task, one timer). The time is always passed in; the
 * session itself lives device-local in `_meta` (see `state.ts`). Rules: docs/design/FOCUS-GUIDELINES.md.
 */
import { z } from 'zod';

export const focusSessionSchema = z.object({
  taskId: z.string().min(1),
  title: z.string(),
  /** Route of the focus screen, so the shell can lead back to it (set by the module). */
  path: z.string().optional(),
  startedAt: z.number(),
  /** Total length including extensions. */
  durationMs: z.number().positive(),
  /** Epoch ms the time is up while running. */
  endAt: z.number().optional(),
  /** Time left while paused. */
  leftMs: z.number().min(0),
  /** True once the "time is up" notice was shown on this device, so it appears only once. */
  announced: z.boolean().optional(),
});
export type FocusSession = z.infer<typeof focusSessionSchema>;

const MINUTE = 60_000;
/** Longest session including extensions. */
export const MAX_SESSION_MS = 4 * 60 * MINUTE;

export function startSession(
  task: { id: string; title: string },
  minutes: number,
  now: number,
  path?: string,
): FocusSession {
  const durationMs = Math.min(Math.max(1, minutes) * MINUTE, MAX_SESSION_MS);
  return {
    taskId: task.id,
    title: task.title,
    ...(path ? { path } : {}),
    startedAt: now,
    durationMs,
    endAt: now + durationMs,
    leftMs: durationMs,
  };
}

export const isRunning = (s: FocusSession): boolean => s.endAt !== undefined;

export const timeLeft = (s: FocusSession, now: number): number =>
  s.endAt === undefined ? s.leftMs : Math.max(0, s.endAt - now);

/** The time is up (the session stays open until the user finishes or extends it). */
export const isOver = (s: FocusSession, now: number): boolean =>
  isRunning(s) && timeLeft(s, now) === 0;

/** 0..1 of the planned time that has passed. */
export function progress(s: FocusSession, now: number): number {
  return Math.min(1, Math.max(0, 1 - timeLeft(s, now) / s.durationMs));
}

export function pause(s: FocusSession, now: number): FocusSession {
  if (!isRunning(s)) return s;
  const { endAt: _drop, ...rest } = s;
  void _drop;
  return { ...rest, leftMs: timeLeft(s, now) };
}

export function resume(s: FocusSession, now: number): FocusSession {
  if (isRunning(s)) return s;
  const ms = s.leftMs > 0 ? s.leftMs : MINUTE;
  return { ...s, endAt: now + ms, leftMs: ms };
}

/** Adds time; after "time is up" it counts from now. Never beyond `MAX_SESSION_MS` in total. */
export function extend(s: FocusSession, minutes: number, now: number): FocusSession {
  const room = Math.max(0, MAX_SESSION_MS - s.durationMs);
  const add = Math.min(Math.max(1, minutes) * MINUTE, room);
  if (add === 0) return s;
  const durationMs = s.durationMs + add;
  if (s.endAt === undefined) return { ...s, durationMs, leftMs: s.leftMs + add };
  return { ...s, durationMs, endAt: Math.max(s.endAt, now) + add, announced: false };
}

export const markAnnounced = (s: FocusSession): FocusSession => ({ ...s, announced: true });

/** "mm:ss" for the countdown; rounds up so it never shows 00:00 early. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
