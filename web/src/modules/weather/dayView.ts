/**
 * What the weather page says for a chosen day or hour (CONCEPT-DAYS §2, COPY §4): the chips, the line of further values,
 * the hints of that day, the moment of the scene and the sentence of the live region. Pure; the page and the head draw
 * what these return.
 */
import { compassIndex } from '@/core/weather/air';
import type { DayRow, Forecast, HourRow } from '@/core/weather/api';
import { dayAsHour, hourRowOf, hoursOf, middleHour } from '@/core/weather/logic';
import type { OfficialWarning } from '@/core/weather/warningsOfficial';
import { dayBounds } from '@/core/sky/moonDay';
import type { tWeather } from '@/strings.weather';
import type { tWeatherPage } from '@/strings.weatherPage';
import { AMOUNT_SHOWN } from './components/HourCards';
import { lineBuilders } from './components/lines';
import { dec } from './components/parts';
import { weatherWarnings, type WeatherWarning } from './warnings';

type Tx = ReturnType<typeof tWeather.get>;
type Tp = ReturnType<typeof tWeatherPage.get>;

/** The moment the page shows: a date of the place and an hour of it, or `null` = the whole day (now on today). */
export interface ViewMoment {
  date: string;
  hour: number | null;
}

export const isNowMoment = (m: ViewMoment, today: string): boolean =>
  m.date === today && m.hour == null;

const hh = (n: number): string => String(n).padStart(2, '0');
const hourNum = (iso: string): number => Number(iso.slice(11, 13));

/**
 * The hour the picture and the head draw for a moment that is not now: the chosen hour, else the day's middle hour,
 * else (no hourly values) the day itself as one hour. `undefined` without a day row.
 */
export function momentHour(
  forecast: Forecast,
  m: ViewMoment,
): { row: HourRow; chosen: boolean; fromDay: boolean } | undefined {
  if (m.hour != null) {
    const row = hourRowOf(forecast, m.date, m.hour);
    if (row) return { row, chosen: true, fromDay: false };
  }
  const mid = middleHour(forecast, m.date);
  if (mid) return { row: mid, chosen: false, fromDay: false };
  const day = forecast.days?.find((d) => d.date === m.date);
  return day ? { row: dayAsHour(day), chosen: false, fromDay: true } : undefined;
}

/** Precipitation that counts for a span: from 0.1 mm (or 0.1 cm of snow). */
const wetHour = (h: HourRow): boolean =>
  (h.mm ?? 0) >= AMOUNT_SHOWN || (h.snow ?? 0) >= AMOUNT_SHOWN;
const snowHour = (h: HourRow): boolean => (h.snow ?? 0) >= AMOUNT_SHOWN;

export interface WetSpan {
  /** `HH` of the first wet hour and of the hour after the last. */
  from: string;
  to: string;
  mm: number;
  /** Most wet hours bring snow: the span is named as snow, with its centimetres. */
  snow: boolean;
  cm: number;
}

/** First to last hour with precipitation of a day (CONCEPT-DAYS §2 "Regen 14–18 Uhr · 4,2 mm"); none when dry. */
export function wetSpan(hours: readonly HourRow[]): WetSpan | undefined {
  const wet = hours.filter(wetHour);
  if (wet.length === 0) return undefined;
  const first = hourNum(wet[0]!.time);
  const last = hourNum(wet[wet.length - 1]!.time);
  const snowy = wet.filter(snowHour).length;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    from: String(first),
    to: String(last + 1),
    mm: round1(wet.reduce((a, h) => a + (h.mm ?? 0), 0)),
    snow: snowy * 2 > wet.length,
    cm: Math.round(wet.reduce((a, h) => a + (h.snow ?? 0), 0)),
  };
}

/** Hours with rain and hours with snow of a day (an hour with snow counts as snow). */
export function wetHours(hours: readonly HourRow[]): { rain: number; snow: number } {
  let rain = 0;
  let snow = 0;
  for (const h of hours) {
    if (snowHour(h)) snow++;
    else if ((h.mm ?? 0) >= AMOUNT_SHOWN) rain++;
  }
  return { rain, snow };
}

export type ChipIcon = 'cloudRain' | 'umbrella' | 'cloudSnow' | 'wind' | 'sun';
export interface DayChip {
  icon: ChipIcon;
  text: string;
  kind?: 'rain';
}

/**
 * The chips of a day (CONCEPT-DAYS §2): rain span or "Kein Regen" · wind and gusts up to · UV up to (the moon of that
 * night takes the third place when there is no UV; the head adds it).
 */
export function dayChips(tp: Tp, tx: Tx, forecast: Forecast, day: DayRow): DayChip[] {
  const hours = hoursOf(forecast, day.date);
  const out: DayChip[] = [];
  const span = wetSpan(hours);
  if (span) {
    out.push(
      span.snow && span.cm >= 1
        ? {
            icon: 'cloudSnow',
            kind: 'rain',
            text: tp.day.snowSpan(span.from, span.to, String(span.cm)),
          }
        : {
            icon: 'cloudRain',
            kind: 'rain',
            text: tp.day.rainSpan(span.from, span.to, dec(span.mm)),
          },
    );
  } else if (hours.length === 0 && (day.mm ?? 0) >= AMOUNT_SHOWN) {
    // A day without hourly values: no span is known, the day's chance and amount say it.
    const part = lineBuilders(tx, forecast).rain(day.rain, day.mm)[0];
    out.push(
      part
        ? { icon: 'cloudRain', kind: 'rain', text: part.t }
        : { icon: 'umbrella', text: tp.day.noRain },
    );
  } else out.push({ icon: 'umbrella', text: tp.day.noRain });
  if (day.wind != null)
    out.push({
      icon: 'wind',
      text: day.gust != null ? tp.day.wind(day.wind, day.gust) : tp.day.windOnly(day.wind),
    });
  if (day.uv != null && day.uv >= 1) out.push({ icon: 'sun', text: tp.day.uv(dec(day.uv)) });
  return out;
}

/** The chips of a chosen hour: rain in that hour, wind of that hour (with its direction), UV of that hour by day. */
export function hourChips(tp: Tp, tx: Tx, h: HourRow): DayChip[] {
  const out: DayChip[] = [];
  const at = hourNum(h.time);
  if (snowHour(h))
    out.push({
      icon: 'cloudSnow',
      kind: 'rain',
      text: tp.day.snowSpan(String(at), String(at + 1), String(Math.max(1, Math.round(h.snow!)))),
    });
  else if ((h.mm ?? 0) >= AMOUNT_SHOWN)
    out.push({
      icon: 'cloudRain',
      kind: 'rain',
      text: tp.day.rainSpan(String(at), String(at + 1), dec(h.mm!)),
    });
  else out.push({ icon: 'umbrella', text: tp.day.noRain });
  if (h.wind != null) {
    const compass = h.dir != null ? tx.compass[compassIndex(h.dir)] : undefined;
    out.push({
      icon: 'wind',
      text: compass ? `${tp.keyWind(h.wind)} ${compass}` : tp.keyWind(h.wind),
    });
  }
  if (!h.night && h.uv != null && h.uv >= 1) out.push({ icon: 'sun', text: tp.keyUv(dec(h.uv)) });
  return out;
}

/**
 * The line of further values for a day (COPY §4): hours with rain · hours with snow · sunshine · cloud · sun times –
 * the high and low stand in the big number. For a chosen hour: the day's high / low · hours with rain · sun times
 * (the hour's own values stand once, in the hour line under the cards).
 */
export function dayRest(
  tp: Tp,
  tx: Tx,
  forecast: Forecast,
  day: DayRow,
  hourChosen: boolean,
): string[] {
  const hours = hoursOf(forecast, day.date);
  const counted = hours.length > 0 ? wetHours(hours) : { rain: day.rainHours ?? 0, snow: 0 };
  const clouds = hours.map((h) => h.cloud).filter((c): c is number => c != null);
  const cloud =
    clouds.length > 0 ? Math.round(clouds.reduce((a, b) => a + b, 0) / clouds.length) : undefined;
  const sun = day.sunrise && day.sunset ? tx.sunSpan(day.sunrise, day.sunset) : undefined;
  const wet = [
    counted.rain >= 1 ? tp.day.rainHours(counted.rain) : undefined,
    counted.snow >= 1 ? tp.day.snowHours(counted.snow) : undefined,
  ];
  const parts = hourChosen
    ? [tp.day.big(day.max, day.min), ...wet, sun]
    : [
        ...wet,
        day.sunMin != null && day.sunMin > 0 ? tp.day.sunshine(dec(day.sunMin / 60)) : undefined,
        cloud != null ? tp.day.cloud(cloud) : undefined,
        sun,
      ];
  return parts.filter((p): p is string => !!p);
}

/** The computed hints of one day (CONCEPT-DAYS §2: "that day's computed hints"). */
export const dayHints = (day: DayRow | undefined): WeatherWarning[] =>
  day ? weatherWarnings([day]) : [];

/** Official warnings whose time span touches the place's day `date`. */
export function officialOfDay(
  official: readonly OfficialWarning[],
  date: string,
  tz: string | undefined,
): OfficialWarning[] {
  const { start, end } = dayBounds(date, tz);
  return official.filter((w) => w.onset < end && w.expires > start);
}

/** The instant (ms) of a place-local `YYYY-MM-DDTHH:mm` (the moon and the sun of a chosen hour). */
export function instantOf(iso: string, tz: string | undefined): number {
  const { start } = dayBounds(iso.slice(0, 10), tz);
  return start + hourNum(iso) * 3_600_000 + Number(iso.slice(14, 16)) * 60_000;
}

/** The address of a moment: `day` and `hour` for anything but now (CONCEPT-DAYS §3). */
export function momentParams(m: ViewMoment, today: string): { day?: string; hour?: string } {
  if (isNowMoment(m, today)) return {};
  return { day: m.date, ...(m.hour != null ? { hour: hh(m.hour) } : {}) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_RE = /^\d{1,2}$/;

/**
 * The moment of an address (CONCEPT-DAYS §3): `day` must be one of the offered days (today … today + 6, as far as
 * cached), `hour` a wall-clock hour 0–23 (alone it means today). Anything broken falls back – a broken day to now,
 * a broken hour to the whole day – and `clean` is false so the page writes the address again (`replace`).
 */
export function parseMoment(
  day: string | null,
  hour: string | null,
  offered: readonly string[],
  today: string,
): { moment: ViewMoment; clean: boolean } {
  const now: ViewMoment = { date: today, hour: null };
  if (day == null && hour == null) return { moment: now, clean: true };
  const date = day ?? today;
  if (!DATE_RE.test(date) || !offered.includes(date)) return { moment: now, clean: false };
  const n = hour != null && HOUR_RE.test(hour) ? Number(hour) : NaN;
  const okHour = Number.isInteger(n) && n >= 0 && n <= 23;
  const moment: ViewMoment = { date, hour: okHour ? n : null };
  const want = momentParams(moment, today);
  return { moment, clean: want.day === (day ?? undefined) && want.hour === (hour ?? undefined) };
}

/** One sentence for the live region (COPY §4): "Freitag, 27. November: Regen, 4° / −3°" or "Freitag 14:00: Regen, 4°". */
export function liveSentence(
  tp: Tp,
  m: ViewMoment,
  names: { date: string; weekday: string; time: string },
  word: string,
  day: DayRow | undefined,
  hourTemp: number | undefined,
): string {
  if (m.hour != null && hourTemp != null)
    return tp.day.liveHour(names.weekday, names.time, word, hourTemp);
  return day ? tp.day.live(names.date, word, day.max, day.min) : `${names.date}: ${word}`;
}
