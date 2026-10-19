import { useEffect, useMemo, useState } from 'react';
import { now } from '@/core/time/now';
import { fetchForecast, type Forecast } from './api';
import { isWeatherActive, useWeatherSettings } from './settings';

const CACHE_KEY = 'tm-weather';
/** A forecast stays fresh for this long (device-local cache, so reopening the Overview costs no request). */
export const WEATHER_TTL_MS = 30 * 60 * 1000;

interface Cached {
  key: string;
  at: number;
  forecast: Forecast;
}

function readCache(): Cached | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(value: Cached): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the line just asks again next time.
  }
}

/** The cached forecast of a place when it is still fresh, else `undefined`. */
export function freshCache(key: string, at: number, cached = readCache()): Forecast | undefined {
  return cached && cached.key === key && at - cached.at < WEATHER_TTL_MS
    ? cached.forecast
    : undefined;
}

/**
 * Forecast of the chosen place, or `undefined` while there is none (no place, switched off, still
 * loading, not reachable). Never an error state: the line then simply is not there. An older cached
 * forecast of the same place is kept when a request fails.
 */
export function useWeather(): { place: string; forecast: Forecast } | undefined {
  const [settings] = useWeatherSettings();
  const [fetched, setFetched] = useState<{ key: string; forecast: Forecast } | undefined>();
  const active = !!settings && isWeatherActive(settings);
  const place = settings?.place ?? '';
  const lat = settings?.lat ?? 0;
  const lon = settings?.lon ?? 0;
  const key = `${lat},${lon}`;
  // Whatever the device-local cache holds for this place (fresh or not) is shown at once.
  const cached = useMemo(() => (active ? readCache() : undefined), [active, key]);

  useEffect(() => {
    if (!active || freshCache(key, now(), cached)) return;
    let alive = true;
    fetchForecast(lat, lon)
      .then((f) => {
        if (!alive) return;
        writeCache({ key, at: now(), forecast: f });
        setFetched({ key, forecast: f });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active, key, lat, lon, cached]);

  const forecast =
    fetched?.key === key ? fetched.forecast : cached?.key === key ? cached.forecast : undefined;
  return active && forecast ? { place, forecast } : undefined;
}
