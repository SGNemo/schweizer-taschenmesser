import { useState } from 'react';
import { requireNotice } from '@/core/legal/notices';
import { daysBetween, today } from '@/core/time/dates';
import { fetchForecast, searchPlaces, type DayRow } from '@/core/weather/api';
import { tWeather } from '@/strings.weather';
import { t } from '@/strings';
import { Button } from '@/ui';

/** Days ahead the forecast reaches (today plus six). */
export const FORECAST_DAYS = 7;

/** Whether a trip date is close enough for a forecast. */
export const inForecastRange = (tripDate: string, day: string): boolean => {
  const d = daysBetween(day, tripDate);
  return d >= 0 && d < FORECAST_DAYS;
};

/** One calm hint for what to pack, from the day's numbers. Rain, heat and cold are the only triggers. */
export function packingHint(
  day: Pick<DayRow, 'min' | 'max' | 'rain' | 'group'>,
): string | undefined {
  const h = t.lists.tripWeather;
  if (day.rain >= 50 || ['rain', 'showers', 'drizzle', 'thunder'].includes(day.group))
    return h.rain;
  if (day.max >= 27) return h.hot;
  if (day.min <= 3) return h.cold;
  return undefined;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'none' | 'noPlace' | 'failed' }
  | { kind: 'day'; day: DayRow };

/**
 * "Wetter am Ziel prüfen" for a trip within the next week: only on a click it asks open-meteo.com for the place
 * you typed (the one-time notice comes first), never on its own. The answer is shown, not stored.
 */
export function TripWeather({ place, tripDate }: { place: string; tripDate: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const w = tWeather.get();
  const h = t.lists.tripWeather;

  async function check() {
    setState({ kind: 'loading' });
    try {
      await requireNotice('weather');
      const found = (await searchPlaces(place))[0];
      if (!found) return setState({ kind: 'noPlace' });
      const forecast = await fetchForecast(found.lat, found.lon);
      const day = forecast.days?.find((d) => d.date === tripDate);
      setState(day ? { kind: 'day', day } : { kind: 'none' });
    } catch {
      setState({ kind: 'failed' });
    }
  }

  if (!inForecastRange(tripDate, today())) return null;
  return (
    <div data-testid="trip-weather">
      {state.kind === 'idle' ? <Button onClick={() => void check()}>{h.check}</Button> : null}
      {state.kind === 'loading' ? <p role="status">{h.loading}</p> : null}
      {state.kind === 'none' ? <p role="status">{h.none}</p> : null}
      {state.kind === 'noPlace' ? <p role="status">{h.noPlace}</p> : null}
      {state.kind === 'failed' ? <p role="status">{h.failed}</p> : null}
      {state.kind === 'day' ? (
        <p role="status">
          {[
            w.codes[state.day.group],
            w.range(Math.round(state.day.min), Math.round(state.day.max)),
            w.rainChance(Math.round(state.day.rain)),
            packingHint(state.day),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
