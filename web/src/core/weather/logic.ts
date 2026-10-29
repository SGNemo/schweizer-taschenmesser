/** Pure parts of the weather line: weather code → words, rain hint, one-line text. */
import type { tWeather } from '@/strings.weather';
import type { DayRow, Forecast, HourRow } from './api';

export type CodeGroup = keyof typeof tWeather.de.codes;

/** WMO weather interpretation codes (Open-Meteo) grouped into nine calm words. */
export function codeGroup(code: number): CodeGroup {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

/** Chance of rain (percent) from which a coming hour counts as "rain". */
export const RAIN_PERCENT = 60;
/** How far ahead the hint looks. */
export const RAIN_LOOKAHEAD_HOURS = 12;

const hourOf = (iso: string): number => Number(iso.slice(11, 13));
const dayOf = (iso: string): string => iso.slice(0, 10);

/**
 * "HH" of the first coming hour (after the current one, same day, within 12 h) with a chance of rain
 * of at least 60 %; `undefined` when there is none or it already rains. `times` are the place's local
 * `YYYY-MM-DDTHH:mm`.
 */
export function rainFrom(
  times: readonly string[],
  probabilities: readonly (number | null)[],
  nowIso: string,
  currentGroup: CodeGroup,
): string | undefined {
  if (['drizzle', 'rain', 'showers', 'thunder'].includes(currentGroup)) return undefined;
  const day = dayOf(nowIso);
  const hour = hourOf(nowIso);
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    const h = hourOf(t);
    if (dayOf(t) !== day || h <= hour || h > hour + RAIN_LOOKAHEAD_HOURS) continue;
    if ((probabilities[i] ?? 0) >= RAIN_PERCENT) return String(h).padStart(2, '0');
  }
  return undefined;
}

/** Hours shown in the preview of "today". */
export const PREVIEW_HOURS = 24;
/** Days shown in the preview: today and the next six. */
export const PREVIEW_DAYS = 7;
/** Chance of rain (percent) from which the preview names it. */
export const RAIN_SHOWN_PERCENT = 30;

/** The next 24 hours from the current one (`nowIso` = the place's local `YYYY-MM-DDTHH:mm`). */
export function hourRows(forecast: Forecast, nowIso: string): HourRow[] {
  const from = `${nowIso.slice(0, 13)}:00`;
  return (forecast.hours ?? []).filter((h) => h.time >= from).slice(0, PREVIEW_HOURS);
}

/** Today and the next six days (`today` = the place's local `YYYY-MM-DD`). */
export function dayRows(forecast: Forecast, today: string): DayRow[] {
  return (forecast.days ?? []).filter((d) => d.date >= today).slice(0, PREVIEW_DAYS);
}

/** True when the preview data is there (values cached before the preview have none). */
export const hasPreview = (forecast: Forecast): boolean => !!forecast.hours && !!forecast.days;

/**
 * The place's local time now (`YYYY-MM-DDTHH:mm`): the time of the fetched values plus what has passed
 * since, so a place in another time zone is not read with this device's clock. Falls back to the device
 * clock for values without a time.
 */
export function placeNowIso(forecast: Forecast, fetchedAt: number, nowMs: number): string {
  if (forecast.time) {
    const base = Date.parse(`${forecast.time}:00Z`);
    if (Number.isFinite(base))
      return new Date(base + Math.max(0, nowMs - fetchedAt)).toISOString().slice(0, 16);
  }
  const d = new Date(nowMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type Rating = 'good' | 'fair' | 'poor';

export interface RatingInput {
  group: CodeGroup;
  /** Chance of rain, percent. */
  rain: number;
  /** Wind and gusts, km/h. */
  wind?: number;
  gust?: number;
  /** Felt temperature (a day: the felt high), °C. */
  temp: number;
}

const GROUP_POINTS: Record<CodeGroup, number> = {
  clear: 0,
  partly: 0,
  cloudy: 0,
  fog: 1,
  drizzle: 1,
  rain: 2,
  showers: 2,
  snow: 2,
  thunder: 3,
};

/**
 * "Is it nice outside?" as three steps, from the sky, the chance of rain, the wind and the felt
 * temperature: nothing against it = good, one thing = fair, two or more = poor. Pure and deliberately
 * simple; the numbers behind it are always shown next to it.
 */
export function rate(i: RatingInput): Rating {
  let points = GROUP_POINTS[i.group];
  points += i.rain >= 70 ? 2 : i.rain >= 40 ? 1 : 0;
  const wind = i.wind ?? 0;
  const gust = i.gust ?? 0;
  points += gust >= 70 || wind >= 50 ? 2 : gust >= 50 || wind >= 35 ? 1 : 0;
  points += i.temp <= -5 || i.temp >= 33 ? 2 : i.temp <= 8 || i.temp >= 29 ? 1 : 0;
  return points >= 2 ? 'poor' : points === 1 ? 'fair' : 'good';
}

export const rateHour = (h: HourRow): Rating =>
  rate({ group: h.group, rain: h.rain, wind: h.wind, gust: h.gust, temp: h.feels ?? h.temp });

export const rateDay = (d: DayRow): Rating =>
  rate({ group: d.group, rain: d.rain, wind: d.wind, gust: d.gust, temp: d.feelsMax ?? d.max });

/** The rating of the current values (no chance of rain is known for "now": the word decides). */
export const rateNow = (f: Forecast): Rating =>
  rate({
    group: f.group,
    rain: 0,
    wind: f.now?.wind,
    gust: f.now?.gust,
    temp: f.now?.feels ?? f.temp,
  });

/**
 * The longest daytime stretch of at least two hours rated "good" (the earlier one on a tie) as `HH` of its first
 * hour and of the hour it ends; `undefined` when there is none.
 */
export function bestWindow(hours: readonly HourRow[]): { from: string; to: string } | undefined {
  let best: { start: number; len: number } | undefined;
  let start = -1;
  for (let i = 0; i <= hours.length; i++) {
    const good = i < hours.length && !hours[i]!.night && rateHour(hours[i]!) === 'good';
    if (good && start < 0) start = i;
    if (!good && start >= 0) {
      const len = i - start;
      if (len >= 2 && (!best || len > best.len)) best = { start, len };
      start = -1;
    }
  }
  if (!best) return undefined;
  const h = (iso: string) => iso.slice(11, 13);
  const last = hours[best.start + best.len - 1]!;
  return {
    from: h(hours[best.start]!.time),
    to: String((Number(h(last.time)) + 1) % 24).padStart(2, '0'),
  };
}
