import { dateTimeFormat } from '@/core/i18n/format';
import { civilTwilight } from '@/core/sky/twilight';
import { now } from '@/core/time/now';
import type { Forecast } from '@/core/weather/api';
import { dayLength } from '@/core/weather/derived';
import { placeNowIso } from '@/core/weather/logic';
import { tWeatherPage } from '@/strings.weatherPage';

/** The last computed day (a render every minute must not search the day again). */
let last: { key: string; value: ReturnType<typeof civilTwilight> } | undefined;
function twilightOf(date: string, lat: number, lon: number, tz?: string) {
  const key = `${date}|${lat}|${lon}|${tz ?? ''}`;
  if (last?.key !== key) last = { key, value: civilTwilight(date, lat, lon, tz) };
  return last.value;
}

/**
 * The first line of "Mond & Himmel" (COPY §7): "Sonne 07:41–16:22 · 8 h 41 min Tageslicht · Dämmerung 07:06–16:57"
 * for the place's day; the twilight is computed on the device (`core/sky/twilight`), the rest is in the day row.
 */
export function useSunLine(
  forecast: Forecast | undefined,
  at: number | undefined,
  lat: number,
  lon: number,
  /** False while "Mond & Himmel" is not shown: nothing is searched. */
  on = true,
): string | undefined {
  const tp = tWeatherPage.use();
  const date =
    on && forecast && at != null ? placeNowIso(forecast, at, now()).slice(0, 10) : undefined;
  const tz = forecast?.tz;
  const day = forecast?.days?.find((d) => d.date === date);
  const twilight = date ? twilightOf(date, lat, lon, tz) : undefined;
  if (!day?.sunrise || !day.sunset) return undefined;
  const length = dayLength(day.sunrise, day.sunset);
  if (length == null) return undefined;
  const span = tp.duration(Math.floor(length / 60), length % 60);
  const time = dateTimeFormat({ hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  return twilight?.dawn != null && twilight.dusk != null
    ? tp.sunLine(
        day.sunrise,
        day.sunset,
        span,
        time.format(twilight.dawn),
        time.format(twilight.dusk),
      )
    : tp.sunLineNoTwilight(day.sunrise, day.sunset, span);
}
