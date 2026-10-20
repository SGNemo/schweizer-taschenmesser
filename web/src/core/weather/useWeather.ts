import { useEffect, useMemo, useState } from 'react';
import { now } from '@/core/time/now';
import { fetchForecast, type Forecast } from './api';
import {
  cacheKey,
  isFresh,
  noteTried,
  readCache,
  readTried,
  shouldFetch,
  writeCache,
} from './cache';
import { isWeatherActive, useWeatherSettings } from './settings';

export interface WeatherView {
  place: string;
  forecast: Forecast;
  /** Epoch ms of the values; the line shows "Stand hh:mm" when they are older than the cache lifetime. */
  at: number;
  stale: boolean;
}

/** One request per place at a time: a second mount while it runs shares it instead of asking again. */
let inflight: { key: string; promise: Promise<Forecast> } | undefined;

function request(key: string, lat: number, lon: number): Promise<Forecast> {
  if (inflight?.key === key) return inflight.promise;
  const promise = fetchForecast(lat, lon).finally(() => {
    if (inflight?.promise === promise) inflight = undefined;
  });
  inflight = { key, promise };
  return promise;
}

/**
 * Forecast of the chosen place, or `undefined` while there is none (no place, switched off, still
 * loading, nothing cached and not reachable). Never an error state: the line then simply is not there.
 * An older cached forecast of the same place is kept (marked stale) when offline or a request fails.
 */
export function useWeather(): WeatherView | undefined {
  const [settings] = useWeatherSettings();
  const [fetched, setFetched] = useState<{ key: string; forecast: Forecast; at: number }>();
  const active = !!settings && isWeatherActive(settings);
  const place = settings?.place ?? '';
  const lat = settings?.lat ?? 0;
  const lon = settings?.lon ?? 0;
  const key = cacheKey(lat, lon);
  const cached = useMemo(() => (active ? readCache() : undefined), [active, key]);

  useEffect(() => {
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!active || !shouldFetch(cached, key, now(), online, readTried())) return;
    let alive = true;
    request(key, lat, lon)
      .then((f) => {
        if (!alive) return;
        const at = now();
        writeCache({ key, at, forecast: f });
        setFetched({ key, forecast: f, at });
      })
      .catch(() => noteTried({ key, at: now() }));
    return () => {
      alive = false;
    };
  }, [active, key, lat, lon, cached]);

  const hit = fetched?.key === key ? fetched : cached?.key === key ? cached : undefined;
  if (!active || !hit) return undefined;
  return { place, forecast: hit.forecast, at: hit.at, stale: !isFresh(hit, key, now()) };
}
