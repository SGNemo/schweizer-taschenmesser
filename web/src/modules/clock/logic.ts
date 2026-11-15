/**
 * What the clock shows for one place at one instant: wall time, day difference and offset to the device's zone, and
 * whether it is night there. Pure: the instant comes from the caller (`useMinuteNow()` → `now()`).
 */
import { offsetMinutes, showIn, zonedInstant } from '@/core/time/zones';

export interface PlaceTime {
  /** `HH:mm` wall time in the place's zone (formatted for the locale by the view). */
  time: string;
  /** `YYYY-MM-DD` there. */
  date: string;
  /** Calendar days between there and here: 1 = tomorrow there, -1 = yesterday there. */
  dayDiff: number;
  /** Minutes the place is ahead of here (Tokyo from Berlin in winter: 480). */
  diffMinutes: number;
  /** 21:00–05:59 there. */
  night: boolean;
}

export function placeTime(at: number, zone: string, hereZone: string): PlaceTime {
  const shown = showIn(at, zone, hereZone);
  const hour = Number(shown.time.slice(0, 2));
  return {
    time: shown.time,
    date: shown.date,
    dayDiff: shown.dayDiff,
    diffMinutes: offsetMinutes(at, zone) - offsetMinutes(at, hereZone),
    night: hour >= 21 || hour < 6,
  };
}

/** "+8 h", "−6 h", "+5:30 h", "−0:30 h"; `undefined` for no difference. */
export function diffLabel(minutes: number): string | undefined {
  if (minutes === 0) return undefined;
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${m ? `${h}:${String(m).padStart(2, '0')}` : h} h`;
}

/** A reminder at a place's wall time, converted to the device's wall time (what the calendar stores). */
export interface RemindAt {
  /** The instant it fires. */
  at: number;
  /** `YYYY-MM-DD` here. */
  date: string;
  /** `HH:mm` here. */
  time: string;
  /** Calendar days between here and there at that instant: 1 = the next day here. */
  dayDiff: number;
}

/**
 * `date` + `time` on the wall clock of `zone`, as date and time here. Each date is converted on its own, so a summer
 * time switch at only one of the two places moves the result by that hour (tested with two dates).
 * `undefined` for invalid input.
 */
export function remindAt(
  date: string,
  time: string,
  zone: string,
  hereZone: string,
): RemindAt | undefined {
  const at = zonedInstant(date, time, zone);
  if (at === undefined) return undefined;
  const here = showIn(at, hereZone, zone);
  return { at, date: here.date, time: here.time, dayDiff: here.dayDiff };
}

/** The dialog's start: the next full hour on the place's wall clock (its date may differ from today here). */
export function nextFullHour(at: number, zone: string): { date: string; time: string } {
  const minute = Math.floor(at / 60_000) * 60_000;
  const there = showIn(minute, zone, zone);
  const minutes = Number(there.time.slice(3, 5));
  const next = showIn(minute + (60 - minutes) * 60_000, zone, zone);
  return { date: next.date, time: next.time };
}
