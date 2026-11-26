/**
 * Values computed on the device from the forecast, no request (CONCEPT-INFO §4): day length, pressure tendency,
 * snowfall line, the dew point's word, the thunder tendency and the hours of one local day. Pure.
 */
import type { HourRow } from './api';

const minutesOf = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutes between sunrise and sunset (local `HH:mm`); `undefined` without both or when they are out of order. */
export function dayLength(sunrise?: string, sunset?: string): number | undefined {
  if (!sunrise || !sunset) return undefined;
  const d = minutesOf(sunset) - minutesOf(sunrise);
  return Number.isFinite(d) && d > 0 ? d : undefined;
}

export type Tendency = 'rising' | 'falling' | 'steady';
/** A change of at least this much (hPa) in three hours counts as rising or falling. */
export const TENDENCY_HPA = 1;

/**
 * Pressure now against three hours earlier: ≥ +1 hPa "rising", ≤ −1 hPa "falling", else "steady"; `undefined`
 * when either hour or its pressure is missing. `at` is the place's local `YYYY-MM-DDTHH:mm` of the hour asked about.
 */
export function pressureTendency(hours: readonly HourRow[], at: string): Tendency | undefined {
  const key = `${at.slice(0, 13)}:00`;
  const i = hours.findIndex((h) => h.time === key);
  if (i < 3) return undefined;
  const now = hours[i]!.hpa;
  const before = hours[i - 3]!;
  // The row three places back must be the hour three hours earlier (a gap in the rows is no tendency).
  const expected = Date.parse(`${key}:00Z`) - 3 * 3600_000;
  if (now == null || before.hpa == null || Date.parse(`${before.time}:00Z`) !== expected)
    return undefined;
  const d = now - before.hpa;
  return d >= TENDENCY_HPA ? 'rising' : d <= -TENDENCY_HPA ? 'falling' : 'steady';
}

/** The snowfall line: the 0 °C level less 300 m, rounded to 100 m (never below 0). */
export function snowLine(freezeM: number | undefined): number | undefined {
  if (freezeM == null || !Number.isFinite(freezeM)) return undefined;
  return Math.max(0, Math.round((freezeM - 300) / 100) * 100);
}
/** "Schneefallgrenze" is named only under this height (and only on a day with precipitation). */
export const SNOW_LINE_MAX = 2500;

export type DewWord = 'muggy' | 'oppressive';
/** "schwül" from 16°, "drückend" from 20° (dew point). */
export function dewWord(dew: number | undefined): DewWord | undefined {
  if (dew == null) return undefined;
  return dew >= 20 ? 'oppressive' : dew >= 16 ? 'muggy' : undefined;
}

export type ThunderTendency = 'moderate' | 'high';
/** The same limits as the picture's thunder levels (CONCEPT §3): 800 and 2000 J/kg. */
export const CAPE_MODERATE = 800;
export const CAPE_HIGH = 2000;
/** "mäßig" or "hoch" from the day's highest `cape`; nothing below (CONCEPT-INFO §2: only those two words). */
export function thunderTendency(capeMax: number | undefined): ThunderTendency | undefined {
  if (capeMax == null) return undefined;
  return capeMax >= CAPE_HIGH ? 'high' : capeMax >= CAPE_MODERATE ? 'moderate' : undefined;
}

/** The hours of one local day (`date` = `YYYY-MM-DD`). */
export const hoursOfDay = (hours: readonly HourRow[] | undefined, date: string): HourRow[] =>
  (hours ?? []).filter((h) => h.time.startsWith(date));

/** The hour row of `at` (its hour), when cached. */
export const hourAt = (hours: readonly HourRow[] | undefined, at: string): HourRow | undefined =>
  hours?.find((h) => h.time === `${at.slice(0, 13)}:00`);
