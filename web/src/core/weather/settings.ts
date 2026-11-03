/**
 * Weather line (synced scope `weather`): on by default, but nothing is shown and nothing is requested
 * until a place is chosen. Only the place name (search) and its rounded position (forecast) ever go to
 * open-meteo.com, see `docs/legal/DATA-FLOWS.md` (`weather`).
 */
import { z } from 'zod';
import { getSettings, setSettings, useSettings } from '@/core/settings/settings';
import { clearCache } from './cache';

export const WEATHER_SCOPE = 'weather';

const placeSchema = z.object({
  label: z.string().max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type ExtraPlace = z.infer<typeof placeSchema>;
/** The weather module shows the chosen place and up to two more (chips on the page). */
export const MAX_EXTRA_PLACES = 2;

export const weatherSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Display name of the chosen place ("Bern, Schweiz"); empty = none. */
  place: z.string().max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  /** More places for the weather page; only the first one feeds the overview widget. */
  extra: z.array(placeSchema).max(MAX_EXTRA_PLACES),
});
export type WeatherSettings = z.infer<typeof weatherSettingsSchema>;

export const DEFAULT_WEATHER: WeatherSettings = {
  enabled: true,
  place: '',
  lat: 0,
  lon: 0,
  extra: [],
};

/** Positions are rounded to two decimals (about a kilometre): no street, no home. */
export const roundCoord = (n: number): number => Math.round(n * 100) / 100;

/** The line shows (and requests) only with a place and the switch on. */
export const isWeatherActive = (s: WeatherSettings): boolean => s.enabled && s.place !== '';

export const getWeatherSettings = () =>
  getSettings(WEATHER_SCOPE, weatherSettingsSchema, DEFAULT_WEATHER);

export const useWeatherSettings = () =>
  useSettings(WEATHER_SCOPE, weatherSettingsSchema, DEFAULT_WEATHER);

export async function chooseWeatherPlace(place: string, lat: number, lon: number): Promise<void> {
  await setSettings(WEATHER_SCOPE, { place, lat: roundCoord(lat), lon: roundCoord(lon) });
}

export const setWeatherEnabled = (enabled: boolean): Promise<void> =>
  setSettings(WEATHER_SCOPE, { enabled });

/** Removes the place and the device-local forecast of it. */
export function clearWeatherPlace(): Promise<void> {
  clearCache();
  return setSettings(WEATHER_SCOPE, { place: '', lat: 0, lon: 0 });
}

/** Adds a place to the page's chips (at most `MAX_EXTRA_PLACES`, no duplicates of the main or another place). */
export async function addExtraPlace(place: string, lat: number, lon: number): Promise<boolean> {
  const current = await getWeatherSettings();
  const next = { label: place, lat: roundCoord(lat), lon: roundCoord(lon) };
  const same = (p: { lat: number; lon: number }) => p.lat === next.lat && p.lon === next.lon;
  if (current.extra.length >= MAX_EXTRA_PLACES || same(current) || current.extra.some(same))
    return false;
  await setSettings(WEATHER_SCOPE, { extra: [...current.extra, next] });
  return true;
}

export async function removeExtraPlace(index: number): Promise<void> {
  const current = await getWeatherSettings();
  await setSettings(WEATHER_SCOPE, { extra: current.extra.filter((_, i) => i !== index) });
}
