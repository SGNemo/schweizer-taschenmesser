import { useEffect, useState } from 'react';
import { now } from '@/core/time/now';
import { fetchForecast, type Forecast } from '@/core/weather/api';
import { useWeather, type WeatherView } from '@/core/weather/useWeather';
import { useWeatherSettings, type ExtraPlace } from '@/core/weather/settings';

const LIFETIME_MS = 30 * 60 * 1000;
/** Forecasts of the extra places, per session only (the main place keeps its persistent cache). */
const memory = new Map<string, { at: number; forecast: Forecast }>();
const keyOf = (p: ExtraPlace) => `${p.lat},${p.lon}`;

export interface ViewedForecast {
  /** Index in [main, ...extra]. */
  index: number;
  places: string[];
  weather: WeatherView | undefined;
  loading: boolean;
}

/**
 * The forecast of the place shown on the weather page: index 0 is the main place (cached on the device, shared with the overview widget),
 * 1 and 2 are the extra places (fetched on demand, kept for the session). Never an error state: no data = `weather` undefined.
 */
export function useViewedForecast(requested: number): ViewedForecast {
  const [settings] = useWeatherSettings();
  const main = useWeather(true);
  const extra = settings?.extra ?? [];
  const index = requested >= 1 && requested <= extra.length ? requested : 0;
  const target = index > 0 ? extra[index - 1] : undefined;
  const [fetched, setFetched] = useState<{ key: string; at: number; forecast: Forecast }>();
  const targetKey = target ? keyOf(target) : undefined;

  useEffect(() => {
    if (!target || !targetKey) return;
    const hit = memory.get(targetKey);
    if (hit && now() - hit.at < LIFETIME_MS) return;
    let alive = true;
    fetchForecast(target.lat, target.lon)
      .then((forecast) => {
        const entry = { at: now(), forecast };
        memory.set(targetKey, entry);
        if (alive) setFetched({ key: targetKey, ...entry });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [target, targetKey]);

  const places = settings && settings.place ? [settings.place, ...extra.map((p) => p.label)] : [];
  if (!target) return { index, places, weather: main, loading: !main && !!settings?.place };
  const remembered = targetKey ? memory.get(targetKey) : undefined;
  const hit = fetched?.key === targetKey ? fetched : remembered;
  return {
    index,
    places,
    weather: hit
      ? {
          place: target.label,
          forecast: hit.forecast,
          at: hit.at,
          stale: now() - hit.at >= LIFETIME_MS,
        }
      : undefined,
    loading: !hit,
  };
}
