/**
 * Time windows (CONCEPT §7, package 5): where in a day the planned sessions sit. Optional – a day
 * without a window keeps its sessions without a time. The minutes stay the truth: a window never
 * changes what the engine planned (capacity, minutes, order), it only gives the sessions of a day a
 * start and an end inside the window, around the blockers that have a time. Pure and deterministic.
 */
import { DAY_PARTS, partRank, type DayPart, type PlanBlocker } from './types';

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

/** Fixed clock borders of the day parts (package 4b, REVIEW-FABLE R2): Vormittag until 12:00, Nachmittag until 18:00, then Abend. Never thirds of a window. */
export const PART_BORDERS_MIN = [12 * 60, 18 * 60] as const;

/**
 * The stretch of a part inside a window ([start, end) in minutes): Vormittag = window start to 12:00,
 * Nachmittag = 12:00 to 18:00, Abend = 18:00 to window end. `undefined` when the part lies wholly outside
 * the window: then it only orders the day.
 */
export function partSpan(window: TimeWindow, part: DayPart): [number, number] | undefined {
  const i = DAY_PARTS.indexOf(part);
  const start = Math.max(toMin(window.from), i === 0 ? 0 : PART_BORDERS_MIN[i - 1]!);
  const end = Math.min(toMin(window.to), i === 2 ? 24 * 60 : PART_BORDERS_MIN[i]!);
  return start < end ? [start, end] : undefined;
}

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
 *
 * A session with a day part (package 4b) starts no earlier than its part's start inside the window
 * (`partSpan`) and after the previous session of the same or an earlier part; when its part has no room it
 * takes the next free place later in the window, else no time. A part wholly outside the window only
 * orders. A session placed later in the day (a pinned „Abend“) is stepped around with the same pause.
 * Without parts this is exactly the plain cursor walk.
 */
export function placeInWindow(
  window: TimeWindow,
  blockers: readonly Pick<PlanBlocker, 'from' | 'to'>[],
  sessions: readonly { id: string; minutes: number; part?: DayPart | undefined }[],
): Map<string, TimeWindow> {
  const spans = freeSpans(window, blockers);
  const out = new Map<string, TimeWindow>();
  const taken: { start: number; end: number; rank: number }[] = [];
  for (const s of sessions) {
    if (s.minutes <= 0) continue;
    const rank = partRank(s.part);
    const own = s.part ? partSpan(window, s.part) : undefined;
    // After every session of the same or an earlier part (the day's order), never before its own part.
    let lower = own ? own[0] : toMin(window.from);
    for (const x of taken) if (x.rank <= rank) lower = Math.max(lower, x.end + SESSION_GAP_MIN);
    for (const [a, b] of spans) {
      let start = ceilStep(Math.max(a, lower));
      // Step around sessions of a later part placed before this one (a higher tier), with the pause.
      for (let moved = true; moved;) {
        moved = false;
        for (const x of taken)
          if (start < x.end + SESSION_GAP_MIN && start + s.minutes > x.start - SESSION_GAP_MIN) {
            start = ceilStep(x.end + SESSION_GAP_MIN);
            moved = true;
          }
      }
      if (start + s.minutes > b) continue;
      out.set(s.id, { from: toHHmm(start), to: toHHmm(start + s.minutes) });
      taken.push({ start, end: start + s.minutes, rank });
      break;
    }
  }
  return out;
}
