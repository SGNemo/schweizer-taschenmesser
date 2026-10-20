/**
 * Device-local cache of the last forecast (localStorage `tm-weather`, never synced): at most one request
 * per place and 30 minutes, nothing requested while offline, an older value is still shown with its time.
 */
import type { Forecast } from './api';

export const CACHE_KEY = 'tm-weather';
/** A forecast stays fresh for this long. */
export const WEATHER_TTL_MS = 30 * 60 * 1000;

export interface Cached {
  key: string;
  at: number;
  forecast: Forecast;
}

/** Cache key of a position (already rounded by the settings). */
export const cacheKey = (lat: number, lon: number): string => `${lat},${lon}`;

export function readCache(): Cached | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as Partial<Cached>;
    return typeof v.key === 'string' && typeof v.at === 'number' && v.forecast
      ? (v as Cached)
      : undefined;
  } catch {
    return undefined;
  }
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
  } catch {
    // Nothing to clear.
  }
}

/** True while the cached value of this place is younger than 30 minutes. */
export const isFresh = (cached: Cached | undefined, key: string, at: number): boolean =>
  !!cached && cached.key === key && at - cached.at < WEATHER_TTL_MS;

/** A request is due when the value is not fresh and the device is online. */
export const shouldFetch = (
  cached: Cached | undefined,
  key: string,
  at: number,
  online: boolean,
): boolean => online && !isFresh(cached, key, at);
