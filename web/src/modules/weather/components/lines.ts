import type { DayRow, Forecast, HourRow } from '@/core/weather/api';
import {
  compassIndex,
  levelRank,
  pollenLevel,
  POLLEN_TYPES,
  type PollenType,
} from '@/core/weather/air';
import { RAIN_SHOWN_PERCENT } from '@/core/weather/logic';
import type { tWeather } from '@/strings.weather';
import { dec, txt, type Part } from './parts';

type Tx = ReturnType<typeof tWeather.get>;

/** The detail pieces of a weather row (rain, wind, humidity, …): every number comes with its word. */
export function lineBuilders(tx: Tx, forecast: Forecast) {
  const rain = (n: number, mm?: number): Part[] =>
    n >= RAIN_SHOWN_PERCENT
      ? [txt(tx.rainChance(n) + (mm && mm >= 0.1 ? ` (${tx.rainMm(dec(mm))})` : ''), 'rain')]
      : [];
  const uv = (v?: number): Part[] =>
    v != null && v >= 1 ? [txt(tx.uvIndex(dec(v)), v >= 6 ? 'uv' : undefined)] : [];
  const compass = (dir?: number) => (dir != null ? ` ${tx.compass[compassIndex(dir)]}` : '');
  const windParts = (wind?: number, gust?: number, dir?: number): Part[] => [
    ...(wind != null ? [txt(tx.windSpeed(wind) + compass(dir))] : []),
    ...(gust != null && wind != null && gust - wind >= 10 ? [txt(tx.gustSpeed(gust))] : []),
  ];
  /** "Pollen: Birke hoch, Gräser mäßig": only what is at least moderate, strongest first, at most three. */
  const pollenOfDay = (date: string): Part[] => {
    const day = forecast.air?.days.find((a) => a.date === date);
    if (!day) return [];
    const list = POLLEN_TYPES.map((t: PollenType) => ({ t, g: day.pollen[t] ?? 0 }))
      .map(({ t, g }) => ({ t, g, l: pollenLevel(t, g) }))
      .filter((r) => levelRank(r.l) >= levelRank('moderate'))
      .sort((a, b) => levelRank(b.l) - levelRank(a.l) || b.g - a.g)
      .slice(0, 3)
      .map((r) => `${tx.pollen[r.t]} ${tx.levels[r.l]}`);
    return list.length > 0 ? [txt(tx.pollenDay(list.join(', ')), 'pollen')] : [];
  };
  const dayLine = (d: DayRow): Part[] => [
    ...rain(d.rain, d.mm),
    ...windParts(d.wind, d.gust, d.dir),
    ...(d.rainHours != null && d.rainHours >= 1 ? [txt(tx.rainHours(d.rainHours), 'rain')] : []),
    ...uv(d.uv),
    ...(d.sunrise && d.sunset ? [txt(tx.sunSpan(d.sunrise, d.sunset))] : []),
    ...(d.sunMin != null && d.sunMin > 0 ? [txt(tx.sunshine(dec(d.sunMin / 60)))] : []),
    ...pollenOfDay(d.date),
  ];
  const hourLine = (h: HourRow): Part[] => [
    ...(h.feels != null && h.feels !== h.temp ? [txt(tx.feels(h.feels))] : []),
    ...rain(h.rain, h.mm),
    ...windParts(h.wind, h.gust, h.dir),
    ...(h.hum != null ? [txt(tx.humidity(h.hum))] : []),
    ...(h.cloud != null ? [txt(tx.cloud(h.cloud))] : []),
    ...(h.hpa != null ? [txt(tx.pressure(h.hpa))] : []),
    ...uv(h.uv),
  ];
  return { rain, uv, windParts, dayLine, hourLine };
}
