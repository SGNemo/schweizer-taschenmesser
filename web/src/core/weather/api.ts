/**
 * Open-Meteo (free, no key, CORS enabled): place search and a short forecast. Nothing but a place name
 * (search) or a rounded position (forecast) is sent. Failures throw `WeatherError`; the caller stays calm.
 */
import { z } from 'zod';
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

/** One hour of the preview; `time` is the place's local `YYYY-MM-DDTHH:mm`, `rain` the chance in percent. */
export interface HourRow {
  time: string;
  temp: number;
  group: CodeGroup;
  rain: number;
}

/** One day of the preview; `date` is the place's local `YYYY-MM-DD`. */
export interface DayRow {
  date: string;
  min: number;
  max: number;
  group: CodeGroup;
  rain: number;
}

export interface Forecast {
  temp: number;
  group: CodeGroup;
  /** "HH" of the first coming hour with rain, when there is one. */
  rainFrom?: string;
  /** The place's local time of the values (`YYYY-MM-DDTHH:mm`); absent in older cached values. */
  time?: string;
  /** Preview data; absent in values cached before the preview existed. */
  hours?: HourRow[];
  days?: DayRow[];
}

/** Hours kept for the preview (a stale offline view still finds its next 12). */
export const HOURS_KEPT = 48;

type Fetch = typeof fetch;

const placesSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        admin1: z.string().optional(),
        country: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
      }),
    )
    .optional(),
});

const forecastSchema = z.object({
  current: z.object({ time: z.string(), temperature_2m: z.number(), weather_code: z.number() }),
  hourly: z
    .object({
      time: z.array(z.string()),
      precipitation_probability: z.array(z.number().nullable()),
      temperature_2m: z.array(z.number().nullable()).optional(),
      weather_code: z.array(z.number().nullable()).optional(),
    })
    .optional(),
  daily: z
    .object({
      time: z.array(z.string()),
      weather_code: z.array(z.number().nullable()),
      temperature_2m_max: z.array(z.number().nullable()),
      temperature_2m_min: z.array(z.number().nullable()),
      precipitation_probability_max: z.array(z.number().nullable()),
    })
    .optional(),
});

type Hourly = NonNullable<z.infer<typeof forecastSchema>['hourly']>;
type Daily = NonNullable<z.infer<typeof forecastSchema>['daily']>;

function hourRowsOf(h: Hourly | undefined, nowIso: string): HourRow[] | undefined {
  if (!h?.temperature_2m || !h.weather_code) return undefined;
  const from = `${nowIso.slice(0, 13)}:00`;
  const rows: HourRow[] = [];
  h.time.forEach((time, i) => {
    const temp = h.temperature_2m![i];
    const code = h.weather_code![i];
    if (time < from || temp == null || code == null) return;
    rows.push({
      time,
      temp: Math.round(temp),
      group: codeGroup(code),
      rain: Math.round(h.precipitation_probability[i] ?? 0),
    });
  });
  return rows.slice(0, HOURS_KEPT);
}

function dayRowsOf(d: Daily | undefined): DayRow[] | undefined {
  if (!d) return undefined;
  const rows: DayRow[] = [];
  d.time.forEach((date, i) => {
    const min = d.temperature_2m_min[i];
    const max = d.temperature_2m_max[i];
    const code = d.weather_code[i];
    if (min == null || max == null || code == null) return;
    rows.push({
      date,
      min: Math.round(min),
      max: Math.round(max),
      group: codeGroup(code),
      rain: Math.round(d.precipitation_probability_max[i] ?? 0),
    });
  });
  return rows;
}

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const out = schema.safeParse(body);
  if (!out.success) throw new WeatherError('shape');
  return out.data;
}

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
  const body = parse(placesSchema, await getJson(url, f));
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
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  })}`;
  const { current: c, hourly, daily } = parse(forecastSchema, await getJson(url, f));
  const group = codeGroup(c.weather_code);
  return {
    temp: Math.round(c.temperature_2m),
    group,
    rainFrom: rainFrom(hourly?.time ?? [], hourly?.precipitation_probability ?? [], c.time, group),
    time: c.time,
    hours: hourRowsOf(hourly, c.time),
    days: dayRowsOf(daily),
  };
}
