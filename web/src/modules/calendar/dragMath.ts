import { addDaysStr } from '@/core/time/dates';

/** Pure maths of dragging in the hour grid (the pointer handling lives in `components/TimeGrid.tsx`). */
export const SNAP_MINUTES = 15;
export const DAY_MINUTES = 24 * 60;
/** Shortest length a resize or a drawn slot can get. */
export const MIN_SLOT = SNAP_MINUTES;

export const snap = (minutes: number, step = SNAP_MINUTES): number =>
  Math.round(minutes / step) * step;

export function toHhmm(minutes: number): string {
  // The last minute of the day is 23:59; "24:00" does not exist.
  const m = Math.min(Math.max(0, Math.round(minutes)), DAY_MINUTES - 1);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export const toMinutes = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export interface Slot {
  date: string;
  startTime: string;
  /** Absent when the event had no end time (moving never invents one). */
  endTime?: string;
}

/** Moves an event by `deltaMinutes` (snapped) and `deltaDays`; the length is kept and the slot stays inside its day. */
export function movedSlot(
  date: string,
  startTime: string,
  endTime: string | undefined,
  deltaMinutes: number,
  deltaDays: number,
): Slot {
  const start = toMinutes(startTime);
  const length = endTime ? Math.max(0, toMinutes(endTime) - start) : 0;
  const latest = DAY_MINUTES - 1 - length;
  const next = Math.min(Math.max(0, snap(start + deltaMinutes)), Math.max(0, latest));
  return {
    date: addDaysStr(date, deltaDays),
    startTime: toHhmm(next),
    ...(endTime ? { endTime: toHhmm(next + length) } : {}),
  };
}

/** New end time after pulling the bottom edge by `deltaMinutes`; never before start + MIN_SLOT. */
export function resizedEnd(
  startTime: string,
  endTime: string | undefined,
  deltaMinutes: number,
): string {
  const start = toMinutes(startTime);
  const end = endTime ? toMinutes(endTime) : start + 60;
  return toHhmm(Math.min(DAY_MINUTES - 1, Math.max(start + MIN_SLOT, snap(end + deltaMinutes))));
}

/** The slot drawn by dragging over an empty column from minute `a` to `b`; `null` for a mere click. */
export function slotFromDrag(a: number, b: number): { startTime: string; endTime: string } | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi - lo < SNAP_MINUTES) return null;
  const start = Math.floor(lo / SNAP_MINUTES) * SNAP_MINUTES;
  const end = Math.min(DAY_MINUTES - 1, Math.ceil(hi / SNAP_MINUTES) * SNAP_MINUTES);
  return { startTime: toHhmm(start), endTime: toHhmm(end) };
}
