/**
 * Device-local cache of the last forecast (localStorage `tm-weather`, never synced): at most one request
 * per place and 30 minutes, nothing requested while offline, an older value is still shown with its time.
 */
import { z } from 'zod';
import { tWeather } from '@/strings.weather';
import type { Forecast } from './api';
import type { CodeGroup } from './logic';

export const CACHE_KEY = 'tm-weather';
/** The last failed request (localStorage, device-local): no retry storm while the service is down. */
export const TRIED_KEY = 'tm-weather-tried';
/** A forecast stays fresh for this long. */
export const WEATHER_TTL_MS = 30 * 60 * 1000;
/** After a failed request the line waits this long before it asks again. */
export const WEATHER_RETRY_MS = 5 * 60 * 1000;

export interface Cached {
  key: string;
  at: number;
  forecast: Forecast;
}

/** Cache key of a position (already rounded by the settings). */
export const cacheKey = (lat: number, lon: number): string => `${lat},${lon}`;

const groupSchema = z.custom<CodeGroup>(
  (v) => typeof v === 'string' && Object.hasOwn(tWeather.de.codes, v),
);
const hourSchema = z.object({
  time: z.string(),
  temp: z.number().finite(),
  group: groupSchema,
  rain: z.number().finite(),
});
const daySchema = z.object({
  date: z.string(),
  min: z.number().finite(),
  max: z.number().finite(),
  group: groupSchema,
  rain: z.number().finite(),
});
/** `time`, `hours` and `days` are optional: a value cached before the preview stays valid for the line. */
const forecastSchema = z.object({
  temp: z.number().finite(),
  group: groupSchema,
  rainFrom: z.string().optional(),
  time: z.string().optional(),
  hours: z.array(hourSchema).optional(),
  days: z.array(daySchema).optional(),
});
const cachedSchema = z.object({
  key: z.string(),
  at: z.number().finite(),
  forecast: forecastSchema,
});
const triedSchema = z.object({ key: z.string(), at: z.number().finite() });

/** Parses a stored value; a damaged or foreign one is removed and reads as absent. */
function readStored<T>(storageKey: string, schema: z.ZodType<T>): T | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return undefined;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // Not JSON: treated like any other damaged value.
    }
    localStorage.removeItem(storageKey);
    return undefined;
  } catch {
    return undefined;
  }
}

export function readCache(): Cached | undefined {
  return readStored(CACHE_KEY, cachedSchema);
}

export function writeCache(value: Cached): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the line just asks again next time.
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(TRIED_KEY);
  } catch {
    // Nothing to clear.
  }
}

export interface Tried {
  key: string;
  at: number;
}

export function readTried(): Tried | undefined {
  return readStored(TRIED_KEY, triedSchema);
}

/** Remembers a failed request so the next one waits `WEATHER_RETRY_MS`. */
export function noteTried(value: Tried): void {
  try {
    localStorage.setItem(TRIED_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the line may ask again sooner, nothing else.
  }
}

/** True while the cached value of this place is younger than 30 minutes. */
export const isFresh = (cached: Cached | undefined, key: string, at: number): boolean =>
  !!cached && cached.key === key && at - cached.at < WEATHER_TTL_MS;

/**
 * A request is due when the value is not fresh (or, when the preview is open, has no preview data yet),
 * the device is online and the last request for this place did not fail within the retry window.
 */
export const shouldFetch = (
  cached: Cached | undefined,
  key: string,
  at: number,
  online: boolean,
  tried?: Tried,
  needsPreview = false,
): boolean =>
  online &&
  (!isFresh(cached, key, at) ||
    (needsPreview && cached !== undefined && !(cached.forecast.hours && cached.forecast.days))) &&
  !(tried && tried.key === key && at - tried.at < WEATHER_RETRY_MS);
