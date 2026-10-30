/**
 * Air quality and pollen of the chosen place (Open-Meteo air-quality API, the same provider and the same
 * rounded position as the forecast; pollen exists for Europe only). Pure parts: parsing, levels, rating.
 * The values are an orientation, not medical advice.
 */
import { z } from 'zod';
import type { Rating } from './logic';

export const POLLEN_TYPES = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'] as const;
export type PollenType = (typeof POLLEN_TYPES)[number];
export type Pollen = Partial<Record<PollenType, number>>;

export interface AirNow {
  /** European air quality index. */
  aqi?: number;
  /** µg/m³ */
  pm25?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  so2?: number;
}

export interface AirDay {
  date: string;
  /** Highest value of the day, grains/m³. */
  pollen: Pollen;
  aqi?: number;
}

export interface Air {
  now: AirNow;
  /** Current pollen, grains/m³ (only the types that have data). */
  pollen: Pollen;
  days: AirDay[];
}

const series = z.array(z.number().nullable()).optional();
const num = z.number().nullable().optional();

const airSchema = z.object({
  current: z
    .object({
      european_aqi: num,
      pm10: num,
      pm2_5: num,
      ozone: num,
      nitrogen_dioxide: num,
      sulphur_dioxide: num,
      alder_pollen: num,
      birch_pollen: num,
      grass_pollen: num,
      mugwort_pollen: num,
      olive_pollen: num,
      ragweed_pollen: num,
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      european_aqi: series,
      alder_pollen: series,
      birch_pollen: series,
      grass_pollen: series,
      mugwort_pollen: series,
      olive_pollen: series,
      ragweed_pollen: series,
    })
    .optional(),
});

const rnd = (n: number | null | undefined): number | undefined =>
  n == null || !Number.isFinite(n) ? undefined : Math.round(n);
const rnd1 = (n: number | null | undefined): number | undefined =>
  n == null || !Number.isFinite(n) ? undefined : Math.round(n * 10) / 10;

/**
 * Reads an air-quality answer; `undefined` when the answer is missing or of the wrong shape (the forecast
 * then simply has no air section). A place without any data gives an empty `Air`, which counts as "asked".
 */
export function parseAir(body: unknown): Air | undefined {
  const out = airSchema.safeParse(body);
  if (!out.success) return undefined;
  const { current: c, hourly: h } = out.data;
  const pollenOf = (get: (t: PollenType) => number | null | undefined): Pollen => {
    const p: Pollen = {};
    for (const t of POLLEN_TYPES) {
      const v = rnd(get(t));
      if (v !== undefined) p[t] = v;
    }
    return p;
  };
  const now: AirNow = {
    aqi: rnd(c?.european_aqi),
    pm25: rnd1(c?.pm2_5),
    pm10: rnd1(c?.pm10),
    o3: rnd(c?.ozone),
    no2: rnd(c?.nitrogen_dioxide),
    so2: rnd(c?.sulphur_dioxide),
  };
  const pollen = pollenOf((t) => c?.[`${t}_pollen`]);
  const byDay = new Map<string, AirDay>();
  h?.time.forEach((time, i) => {
    const date = time.slice(0, 10);
    const day = byDay.get(date) ?? { date, pollen: {} };
    for (const t of POLLEN_TYPES) {
      const v = rnd(h[`${t}_pollen`]?.[i]);
      if (v !== undefined) day.pollen[t] = Math.max(day.pollen[t] ?? 0, v);
    }
    const a = rnd(h.european_aqi?.[i]);
    if (a !== undefined) day.aqi = Math.max(day.aqi ?? 0, a);
    byDay.set(date, day);
  });
  return { now, pollen, days: [...byDay.values()] };
}

export type PollenLevel = 'none' | 'low' | 'moderate' | 'high' | 'veryHigh';

/** Upper limits (grains/m³) of "low", "moderate" and "high" per type; above the last it is "very high". */
const LIMITS: Record<PollenType, readonly [number, number, number]> = {
  alder: [15, 90, 1500],
  birch: [15, 90, 1500],
  olive: [15, 90, 1500],
  grass: [5, 25, 200],
  mugwort: [5, 20, 100],
  ragweed: [3, 10, 50],
};

export function pollenLevel(type: PollenType, grains: number): PollenLevel {
  const [low, moderate, high] = LIMITS[type];
  if (grains < 1) return 'none';
  if (grains < low) return 'low';
  if (grains < moderate) return 'moderate';
  if (grains < high) return 'high';
  return 'veryHigh';
}

export const LEVEL_ORDER: readonly PollenLevel[] = ['none', 'low', 'moderate', 'high', 'veryHigh'];
export const levelRank = (l: PollenLevel): number => LEVEL_ORDER.indexOf(l);

/** The six bands of the European air quality index. */
export type AqiBand = 'veryGood' | 'good' | 'fair' | 'poor' | 'veryPoor' | 'extreme';
export function aqiBand(aqi: number): AqiBand {
  if (aqi <= 20) return 'veryGood';
  if (aqi <= 40) return 'good';
  if (aqi <= 60) return 'fair';
  if (aqi <= 80) return 'poor';
  if (aqi <= 100) return 'veryPoor';
  return 'extreme';
}

/** The pollen types with data, strongest level first (none last), for a list that shows what matters. */
export function pollenRows(
  pollen: Pollen,
): { type: PollenType; grains: number; level: PollenLevel }[] {
  return (Object.keys(pollen) as PollenType[])
    .map((type) => ({ type, grains: pollen[type]!, level: pollenLevel(type, pollen[type]!) }))
    .sort((a, b) => levelRank(b.level) - levelRank(a.level) || b.grains - a.grains);
}

/** The highest pollen level among the types. */
export function topLevel(pollen: Pollen): PollenLevel {
  return pollenRows(pollen)[0]?.level ?? 'none';
}

/**
 * "How is the air for the airways?" in the same three steps as the weather rating, deliberately careful:
 * a "fair" index or a moderate pollen load is already "so-so", a "poor" index or a high load "unpleasant".
 * `undefined` without any value.
 */
export function rateAir(air: Air | undefined): Rating | undefined {
  if (!air) return undefined;
  const aqi = air.now.aqi;
  const level = topLevel(air.pollen);
  if (aqi === undefined && level === 'none' && Object.keys(air.pollen).length === 0)
    return undefined;
  if ((aqi ?? 0) > 60 || levelRank(level) >= levelRank('high')) return 'poor';
  if ((aqi ?? 0) > 40 || levelRank(level) >= levelRank('moderate')) return 'fair';
  return 'good';
}

/** A compass point 0–7 (N, NE, E, SE, S, SW, W, NW) for a wind direction in degrees (where it blows from). */
export const compassIndex = (deg: number): number =>
  Math.round((((deg % 360) + 360) % 360) / 45) % 8;
