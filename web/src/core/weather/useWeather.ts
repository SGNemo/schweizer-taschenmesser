import { useEffect, useMemo, useRef, useState } from 'react';
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
 * `needsPreview`: the preview is open, so a cached value without preview data is asked for once more.
 */
export function useWeather(needsPreview = false): WeatherView | undefined {
  return useWeatherRequest(needsPreview).view;
}

/**
 * `useWeather` plus whether a forecast is still on its way (`coming`): weather is on, nothing is shown yet, the
 * device is online, a request runs or is about to, and none has failed for this place in this mount. False once the
 * request failed, offline or switched off, so a page does not wait for a forecast that will not come (0b-8).
 */
export function useWeatherRequest(needsPreview = false): {
  view: WeatherView | undefined;
  coming: boolean;
} {
  const [settings] = useWeatherSettings();
  const [fetched, setFetched] = useState<{ key: string; forecast: Forecast; at: number }>();
  const active = !!settings && isWeatherActive(settings);
  const place = settings?.place ?? '';
  const lat = settings?.lat ?? 0;
  const lon = settings?.lon ?? 0;
  const key = cacheKey(lat, lon);
  const cached = useMemo(() => (active ? readCache() : undefined), [active, key]);

  const hit = fetched?.key === key ? fetched : cached?.key === key ? cached : undefined;
  const [failedKey, setFailedKey] = useState<string>();

  // One request per place (and preview need) per mount: a re-render that only swaps the cached object must not ask again.
  // The answer is kept even if the effect re-ran meanwhile; only an unmounted hook stops listening.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const asked = useRef<string | undefined>(undefined);
  useEffect(() => {
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!active || !shouldFetch(hit, key, now(), online, readTried(), needsPreview)) return;
    const token = `${key}|${needsPreview}`;
    if (asked.current === token) return;
    asked.current = token;
    request(key, lat, lon)
      .then((f) => {
        const at = now();
        writeCache({ key, at, forecast: f });
        if (mounted.current) setFetched({ key, forecast: f, at });
      })
      .catch(() => {
        asked.current = undefined;
        noteTried({ key, at: now() });
        if (mounted.current) setFailedKey(key);
      });
  }, [active, key, lat, lon, hit, needsPreview]);

  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!active || !hit)
    return {
      view: undefined,
      coming:
        active &&
        !!place &&
        failedKey !== key &&
        (inflight?.key === key || shouldFetch(hit, key, now(), online, readTried(), needsPreview)),
    };
  return {
    view: { place, forecast: hit.forecast, at: hit.at, stale: !isFresh(hit, key, now()) },
    coming: false,
  };
}
