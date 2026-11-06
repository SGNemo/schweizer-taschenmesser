/**
 * Time windows (CONCEPT §7, package 5): where in a day the planned sessions sit. Optional – a day
 * without a window keeps its sessions without a time. The minutes stay the truth: a window never
 * changes what the engine planned (capacity, minutes, order), it only gives the sessions of a day a
 * start and an end inside the window, around the blockers that have a time. Pure and deterministic.
 */
import type { PlanBlocker } from './types';

export interface TimeWindow {
  /** 'HH:mm', local. */
  from: string;
  /** 'HH:mm', after `from`. */
  to: string;
}

/** Start times sit on this grid (minutes). */
export const SLOT_STEP_MIN = 5;
/** A short pause between two sessions of a day (never planned work, never taken from the minutes). */
export const SESSION_GAP_MIN = 15;

const HHMM = /^([01]?\d|2[0-3])(?:[:.]([0-5]\d))?$/;

export const toMin = (hhmm: string): number =>
  Number(hhmm.slice(0, hhmm.indexOf(':'))) * 60 + Number(hhmm.slice(hhmm.indexOf(':') + 1));

export const toHHmm = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** A window with `from` before `to`, both 'HH:mm'; anything else is no window. */
export function validWindow(w: { from?: string; to?: string } | undefined): TimeWindow | undefined {
  if (!w?.from || !w.to) return undefined;
  const a = parseTime(w.from);
  const b = parseTime(w.to);
  return a && b && toMin(a) < toMin(b) ? { from: a, to: b } : undefined;
}

/** '9', '9:30', '09.30', '09:30' → '09:30'; anything else → undefined. */
export function parseTime(text: string): string | undefined {
  const m = HHMM.exec(text.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, '0')}:${m[2] ?? '00'}`;
}

/**
 * A window as the user types it in the settings: '09:00–17:00', '9-17', '9:30 – 12'. Empty or not
 * readable = no window (the setting then keeps the day without times, never fails the settings).
 */
export function parseWindow(text: string | undefined): TimeWindow | undefined {
  const parts = (text ?? '').split(/\s*[-–—]\s*|\s+bis\s+|\s+to\s+/i);
  if (parts.length !== 2) return undefined;
  return validWindow({ from: parts[0], to: parts[1] });
}

/** The written form of a window: '09:00–17:00'. */
export const windowText = (w: TimeWindow): string => `${w.from}–${w.to}`;

/** Minutes between `from` and `to` of a blocker with both times, else undefined. */
export function spanMin(b: { from?: string; to?: string }): number | undefined {
  const w = validWindow(b);
  return w ? toMin(w.to) - toMin(w.from) : undefined;
}

/** The free stretches of a window: the window minus every blocker that has a time ([start, end) in minutes). */
export function freeSpans(
  window: TimeWindow,
  blockers: readonly Pick<PlanBlocker, 'from' | 'to'>[],
): [number, number][] {
  const busy = blockers
    .map((b) => validWindow(b))
    .filter((w): w is TimeWindow => w !== undefined)
    .map((w) => [toMin(w.from), toMin(w.to)] as const)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const spans: [number, number][] = [];
  let cursor = toMin(window.from);
  const end = toMin(window.to);
  for (const [a, b] of busy) {
    if (b <= cursor) continue;
    if (a >= end) break;
    if (a > cursor) spans.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < end) spans.push([cursor, end]);
  return spans;
}

const ceilStep = (min: number): number => Math.ceil(min / SLOT_STEP_MIN) * SLOT_STEP_MIN;

/**
 * Lays the sessions of one day (in the day's order) into the free stretches of its window: each one
 * at the earliest start on the 5-minute grid after the previous session plus a short pause, whole,
 * never split, never shortened. A session that does not fit anywhere after the previous one keeps no
 * time (it stays in the day's summary chip); a later, shorter one may still fit. Same input, same output.
 */
export function placeInWindow(
  window: TimeWindow,
  blockers: readonly Pick<PlanBlocker, 'from' | 'to'>[],
  sessions: readonly { id: string; minutes: number }[],
): Map<string, TimeWindow> {
  const spans = freeSpans(window, blockers);
  const out = new Map<string, TimeWindow>();
  let cursor = toMin(window.from);
  for (const s of sessions) {
    if (s.minutes <= 0) continue;
    for (const [a, b] of spans) {
      const start = ceilStep(Math.max(a, cursor));
      if (start + s.minutes > b) continue;
      out.set(s.id, { from: toHHmm(start), to: toHHmm(start + s.minutes) });
      cursor = start + s.minutes + SESSION_GAP_MIN;
      break;
    }
  }
  return out;
}
