/**
 * Open-Meteo (free, no key, CORS enabled): place search and a short forecast. Nothing but a place name
 * (search) or a rounded position (forecast) is sent. Failures throw `WeatherError`; the caller stays calm.
 */
import { getLang } from '@/core/i18n/lang';
import { codeGroup, rainFrom, type CodeGroup } from './logic';

export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 8000;

export class WeatherError extends Error {
  constructor(message = 'weather') {
    super(message);
    this.name = 'WeatherError';
  }
}

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

export interface Forecast {
  temp: number;
  group: CodeGroup;
  /** "HH" of the first coming hour with rain, when there is one. */
  rainFrom?: string;
}

type Fetch = typeof fetch;

async function getJson(url: string, f: Fetch): Promise<unknown> {
  try {
    const res = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new WeatherError(`http ${res.status}`);
    return await res.json();
  } catch (e) {
    throw e instanceof WeatherError ? e : new WeatherError('network');
  }
}

/** Open-Meteo knows "pt", not "pt-BR". */
const apiLang = (): string => getLang().split('-')[0]!;

export async function searchPlaces(query: string, f: Fetch = fetch): Promise<Place[]> {
  const name = query.trim();
  if (name.length < 2) return [];
  const url = `${GEOCODING_URL}?${new URLSearchParams({ name, count: '5', language: apiLang(), format: 'json' })}`;
  const body = (await getJson(url, f)) as {
    results?: {
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
    }[];
  };
  return (body.results ?? []).map((r) => ({
    label: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : undefined, r.country]
      .filter(Boolean)
      .join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

export async function fetchForecast(lat: number, lon: number, f: Fetch = fetch): Promise<Forecast> {
  const url = `${FORECAST_URL}?${new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code',
    hourly: 'precipitation_probability',
    timezone: 'auto',
    forecast_days: '1',
  })}`;
  const body = (await getJson(url, f)) as {
    current?: { time: string; temperature_2m: number; weather_code: number };
    hourly?: { time: string[]; precipitation_probability: (number | null)[] };
  };
  const c = body.current;
  if (!c || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number')
    throw new WeatherError('shape');
  const group = codeGroup(c.weather_code);
  return {
    temp: Math.round(c.temperature_2m),
    group,
    rainFrom: rainFrom(
      body.hourly?.time ?? [],
      body.hourly?.precipitation_probability ?? [],
      c.time,
      group,
    ),
  };
}
