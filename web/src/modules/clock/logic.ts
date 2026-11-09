/**
 * What the clock shows for one place at one instant: wall time, day difference and offset to the device's zone, and
 * whether it is night there. Pure: the instant comes from the caller (`useMinuteNow()` → `now()`).
 */
import { offsetMinutes, showIn } from '@/core/time/zones';

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
