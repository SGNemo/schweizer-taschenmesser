import { addDaysStr } from '@/core/time/dates';
import { cacheKey, readCache } from '@/core/weather/cache';
import { getWeatherSettings, isWeatherActive } from '@/core/weather/settings';
import { weatherWarnings, type WeatherWarning } from './warnings';

/**
 * Warnings for today and tomorrow at the main place, read from the forecast that is already cached on this
 * device. Never asks the network (the page does that), so "Jetzt wichtig" and the notification stay quiet
 * and free of requests. Empty without an active place or a cached forecast of that place.
 */
export async function warningsNow(today: string): Promise<WeatherWarning[]> {
  const s = await getWeatherSettings();
  if (!isWeatherActive(s)) return [];
  const cached = readCache();
  if (!cached || cached.key !== cacheKey(s.lat, s.lon)) return [];
  const tomorrow = addDaysStr(today, 1);
  return weatherWarnings(
    (cached.forecast.days ?? []).filter((d) => d.date >= today && d.date <= tomorrow),
    5,
  );
}
