import { addDaysStr } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { cacheKey, readCache } from '@/core/weather/cache';
import { getWeatherSettings, isWeatherActive, officialOn } from '@/core/weather/settings';
import {
  activeOfficial,
  readOfficial,
  withoutReplaced,
  type OfficialWarning,
} from '@/core/weather/warningsOfficial';
import { weatherWarnings, type WeatherWarning } from './warnings';

/**
 * Warnings for today and tomorrow at the main place, read from the forecast that is already cached on this
 * device. Never asks the network (the page does that), so "Jetzt wichtig" and the notification stay quiet
 * and free of requests. Empty without an active place or a cached forecast of that place. Today's hints of a kind an
 * official DWD warning has are left out (package 3b).
 */
export async function warningsNow(today: string): Promise<WeatherWarning[]> {
  const s = await getWeatherSettings();
  if (!isWeatherActive(s)) return [];
  const cached = readCache();
  if (!cached || cached.key !== cacheKey(s.lat, s.lon)) return [];
  const tomorrow = addDaysStr(today, 1);
  // An official warning replaces today's computed hint of its kind, here as on the page (CONCEPT-SOURCES §3).
  const official = officialOn(s) ? readOfficial(s.lat, s.lon) : undefined;
  return withoutReplaced(
    weatherWarnings(
      (cached.forecast.days ?? []).filter((d) => d.date >= today && d.date <= tomorrow),
      5,
    ),
    official && activeOfficial(official, now(), cached.forecast.tz),
    today,
  );
}

/** Official DWD warnings in force now or later today at the main place (cached; never asks the network). */
export async function officialNow(): Promise<{ warnings: OfficialWarning[]; tz?: string }> {
  const s = await getWeatherSettings();
  if (!isWeatherActive(s) || !officialOn(s)) return { warnings: [] };
  const all = readOfficial(s.lat, s.lon);
  const tz = readCache()?.forecast.tz;
  return { warnings: all ? activeOfficial(all, now(), tz) : [], ...(tz && { tz }) };
}
