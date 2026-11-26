import { useMemo } from 'react';
import type { MoonNow } from '@/core/sky/moonDay';
import { now } from '@/core/time/now';
import { sceneOf, type MoonInput, type SceneState } from '@/core/weather/scene';
import { sceneModeOf, useWeatherSettings } from '@/core/weather/settings';
import type { WeatherView } from '@/core/weather/useWeather';
import { useSceneEnv } from './useSceneEnv';

/** What the scene needs of `core/sky` `moonNow` (as the weather head passes it). */
export function moonInputOf(m: MoonNow): MoonInput {
  return {
    lit: m.lit,
    tilt: m.tilt,
    alt: m.alt,
    az: m.az,
    full: m.name === 'full',
    superMoon: m.day.superMoon,
  };
}

/**
 * The scene's state for the small versions (overview line, widget): the same `sceneOf` as the head, for the same
 * theme, colour mode and setting "Bild im Wetter-Kopf" ("Schlicht" → sky and body only), once per minute; never
 * moving. `moon` is absent while "Mond und Himmelsereignisse" is off (then no moon is drawn).
 */
export function useSmallScene(
  weather: WeatherView | undefined,
  lat: number,
  moon: MoonNow | undefined,
): SceneState | undefined {
  const env = useSceneEnv();
  const [settings] = useWeatherSettings();
  const level = sceneModeOf(settings) === 'plain' ? 'plain' : 'full';
  const minute = Math.floor(now() / 60_000);
  return useMemo(
    () =>
      weather
        ? sceneOf({
            forecast: weather.forecast,
            at: weather.at,
            nowMs: minute * 60_000,
            lat,
            theme: env.theme,
            calm: env.calm,
            level,
            motion: false,
            moon: moon ? moonInputOf(moon) : undefined,
          })
        : undefined,
    [weather, minute, lat, env.theme, env.calm, level, moon],
  );
}
