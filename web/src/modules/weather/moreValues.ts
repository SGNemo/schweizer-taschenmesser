/**
 * The groups of "Mehr Werte" (CONCEPT-INFO §2, COPY §6) for one day: the day's sums and highs from the day row and its
 * hours, the moment's values from one reference hour (now on today; package C passes the hour it shows). A line
 * without a value is left out, a group without lines too. Pure.
 */
import { compassIndex } from '@/core/weather/air';
import type { DayRow, Forecast, HourRow } from '@/core/weather/api';
import {
  dayLength,
  dewWord,
  hourAt,
  hoursOfDay,
  pressureTendency,
  snowLine,
  SNOW_LINE_MAX,
  thunderTendency,
} from '@/core/weather/derived';
import type { tWeatherPage } from '@/strings.weatherPage';
import { dec } from './components/parts';
import { visKm } from './components/hourLine';

type Tp = ReturnType<typeof tWeatherPage.get>;

export type MoreGroupId = 'feel' | 'precip' | 'wind' | 'sky' | 'pressure' | 'thunder';
export interface MoreItem {
  label: string;
  value: string;
  /** Indented under the line before it ("tief", "mittel", "hoch" under "Bewölkung"). */
  sub?: boolean;
}
export type MoreGroup =
  | { id: MoreGroupId; title: string; items: MoreItem[] }
  | { id: MoreGroupId; title: string; text: string };

const item = (label: string, value: string | undefined, sub?: boolean): MoreItem[] =>
  value === undefined ? [] : [{ label, value, ...(sub ? { sub } : {}) }];
const deg = (n: number | undefined) => (n == null ? undefined : `${n}°`);
const pct = (n: number | undefined) => (n == null ? undefined : `${n} %`);
const mean = (xs: number[]) =>
  xs.length === 0 ? undefined : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const nums = (hours: HourRow[], pick: (h: HourRow) => number | undefined): number[] =>
  hours.map(pick).filter((v): v is number => v != null);

export function moreGroups(
  tp: Tp,
  forecast: Forecast,
  day: DayRow,
  /** The place's local `YYYY-MM-DDTHH:mm` of the reference hour. */
  at: string,
  /** True when `at` is now: the current values win over the hour's. */
  isNow: boolean,
): MoreGroup[] {
  const L = tp.moreLabel;
  const V = tp.moreValue;
  const hours = hoursOfDay(forecast.hours, day.date);
  const ref = hourAt(forecast.hours, at);
  const now = isNow ? forecast.now : undefined;
  const g = (id: MoreGroupId, items: MoreItem[]): MoreGroup[] =>
    items.length > 0 ? [{ id, title: tp.moreGroups[id], items }] : [];
  const t = (id: MoreGroupId, text: string | undefined): MoreGroup[] =>
    text ? [{ id, title: tp.moreGroups[id], text }] : [];

  const dew = ref?.dew;
  const dw = dewWord(dew);
  const feel = [
    ...item(L.feels, deg(now?.feels ?? ref?.feels)),
    ...item(L.dew, dew == null ? undefined : dw ? `${dew}°, ${tp.dewWord[dw]}` : `${dew}°`),
    ...item(L.humidity, pct(now?.hum ?? ref?.hum)),
  ];

  const wet = (day.mm ?? 0) >= 0.1;
  const newSnow = nums(hours, (h) => h.snow).reduce((a, b) => a + b, 0);
  const depthCm = ref?.snowDepth != null ? Math.round(ref.snowDepth * 100) : undefined;
  const freezeWet = nums(
    hours.filter((h) => (h.mm ?? 0) >= 0.1),
    (h) => h.freeze,
  );
  const line = wet && freezeWet.length > 0 ? snowLine(Math.min(...freezeWet)) : undefined;
  const precip = [
    ...item(L.amount, wet ? `${dec(day.mm!)} mm` : undefined),
    ...item(
      L.rainHours,
      day.rainHours != null && day.rainHours >= 1 ? String(day.rainHours) : undefined,
    ),
    ...item(L.newSnow, newSnow >= 0.5 ? `${Math.round(newSnow)} cm` : undefined),
    ...item(L.snowDepth, depthCm != null && depthCm >= 1 ? `${depthCm} cm` : undefined),
    ...item(L.snowLine, line != null && line < SNOW_LINE_MAX ? V.snowLine(dec(line)) : undefined),
  ];

  const wind = [
    ...item(
      L.mean,
      ((m) => (m == null ? undefined : `${m} km/h`))(mean(nums(hours, (h) => h.wind))),
    ),
    ...item(L.gusts, day.gust != null ? V.gustsUpTo(day.gust) : undefined),
    ...item(L.dir, day.dir != null ? V.from(tp.dirName[compassIndex(day.dir)]!) : undefined),
  ];

  const length = dayLength(day.sunrise, day.sunset);
  const sky = [
    ...item(L.cloud, pct(now?.cloud ?? ref?.cloud)),
    ...item(L.low, pct(ref?.cloudLow), true),
    ...item(L.mid, pct(ref?.cloudMid), true),
    ...item(L.high, pct(ref?.cloudHigh), true),
    ...item(
      L.sunshine,
      day.sunMin != null && length != null
        ? V.sunshine(dec(day.sunMin / 60), dec(length / 60))
        : undefined,
    ),
    ...item(L.vis, ref?.vis != null ? `${visKm(ref.vis)} km` : undefined),
  ];

  const hpa = now?.hpa ?? ref?.hpa;
  const tendency = pressureTendency(forecast.hours ?? [], at);
  const pressure =
    hpa == null ? undefined : tendency ? V.pressure(hpa, tp.tendency[tendency]) : `${hpa} hPa`;

  const capes = nums(hours, (h) => h.cape);
  const thunder = thunderTendency(capes.length > 0 ? Math.max(...capes) : undefined);

  return [
    ...g('feel', feel),
    ...g('precip', precip),
    ...g('wind', wind),
    ...g('sky', sky),
    ...t('pressure', pressure),
    ...t('thunder', thunder ? tp.thunderWord[thunder] : undefined),
  ];
}
