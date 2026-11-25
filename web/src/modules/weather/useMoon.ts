import { useMemo } from 'react';
import { moonNow, type MoonNow } from '@/core/sky/moonDay';
import { now } from '@/core/time/now';
import { skyOn, useWeatherSettings } from '@/core/weather/settings';

/**
 * The moon now at the viewed place, once per minute; `undefined` while "Mond und Himmelsereignisse" is off (then no
 * moon anywhere: scene, chip, card, day rows). Calculated on the device; position and time never leave it.
 */
export function useMoon(
  lat: number,
  lon: number,
  tz: string | undefined,
  /** False while there is no place (nothing to show the moon for). */
  enabled = true,
): MoonNow | undefined {
  const [settings] = useWeatherSettings();
  const on = enabled && !!settings && skyOn(settings);
  const minute = Math.floor(now() / 60_000);
  return useMemo(
    () => (on ? moonNow(minute * 60_000, lat, lon, tz) : undefined),
    [on, minute, lat, lon, tz],
  );
}
