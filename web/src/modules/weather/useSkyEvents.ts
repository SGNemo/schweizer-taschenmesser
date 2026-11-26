import { useMemo } from 'react';
import type { AuroraTonight } from '@/core/sky/aurora';
import { eventsFor, type SkyEvents } from '@/core/sky/events';
import { now } from '@/core/time/now';
import type { Forecast } from '@/core/weather/api';
import { skyOn, useWeatherSettings } from '@/core/weather/settings';

/**
 * The sky events at the viewed place, once per minute (CONCEPT-EVENTS §2): what the scene draws, the hero's chip, the
 * card's "Als Nächstes" and the safety pill. `undefined` while "Mond und Himmelsereignisse" is off or without a
 * forecast. Calculated on the device from position, time and the forecast already fetched.
 */
export function useSkyEvents(
  lat: number,
  lon: number,
  forecast: Forecast | undefined,
  enabled = true,
  /** Old values (offline): rain, cloud and dust of hours ago say nothing about now; time and place still hold. */
  stale = false,
  /** Aurora possible tonight at the main place (package 3b). */
  aurora?: AuroraTonight,
): SkyEvents | undefined {
  const [settings] = useWeatherSettings();
  const on = enabled && !!forecast && !!settings && skyOn(settings);
  const minute = Math.floor(now() / 60_000);
  return useMemo(
    () =>
      on && forecast
        ? eventsFor({
            nowMs: minute * 60_000,
            aurora,
            lat,
            lon,
            tz: forecast.tz,
            ...(!stale && {
              code: forecast.code,
              cloud: forecast.now?.cloud,
              hours: forecast.hours,
              dust: forecast.air?.now.dust,
            }),
          })
        : undefined,
    [on, minute, lat, lon, forecast, stale, aurora],
  );
}
