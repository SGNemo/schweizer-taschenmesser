/**
 * Open-Meteo (free, no key, CORS enabled): place search and a short forecast. Nothing but a place name
 * (search) or a rounded position (forecast) is sent. Failures throw `WeatherError`; the caller stays calm.
 */
import { getPlatform } from '@/core/platform';
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

/**
 * One hour of the preview; `time` is the place's local `YYYY-MM-DDTHH:mm`, `rain` the chance in percent.
 * The detail fields are optional: values cached before the detail view have none of them.
 */
export interface HourRow {
  time: string;
  temp: number;
  group: CodeGroup;
  rain: number;
  /** Felt temperature, °C. */
  feels?: number;
  /** Precipitation of the hour, mm (one decimal). */
  mm?: number;
  /** Wind and gusts, km/h. */
  wind?: number;
  gust?: number;
  /** Relative humidity, percent. */
  hum?: number;
  uv?: number;
  /** True when the sun is down. */
  night?: boolean;
}

/** One day of the preview; `date` is the place's local `YYYY-MM-DD`. */
export interface DayRow {
  date: string;
  min: number;
  max: number;
  group: CodeGroup;
  rain: number;
  feelsMin?: number;
  feelsMax?: number;
  mm?: number;
  wind?: number;
  gust?: number;
  uv?: number;
  /** Local `HH:mm`. */
  sunrise?: string;
  sunset?: string;
  /** Minutes of sunshine. */
  sunMin?: number;
}

/** The current values beyond temperature and word. */
export interface NowDetail {
  feels?: number;
  hum?: number;
  wind?: number;
  gust?: number;
  night?: boolean;
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
  /** Current detail (felt temperature, wind, humidity); absent in older cached values. */
  now?: NowDetail;
}

/** Hours kept for the preview (a stale offline view still finds its next 12). */
export const HOURS_KEPT = 48;

type Fetch = typeof fetch;
/** Through the platform, so the connection log sees it and "Netzwerk sperren" applies. */
const platformFetch: Fetch = (input, init) => getPlatform().fetch(input, init);

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

const series = z.array(z.number().nullable()).optional();
const stringSeries = z.array(z.string().nullable()).optional();

const forecastSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    weather_code: z.number(),
    apparent_temperature: z.number().nullable().optional(),
    relative_humidity_2m: z.number().nullable().optional(),
    wind_speed_10m: z.number().nullable().optional(),
    wind_gusts_10m: z.number().nullable().optional(),
    is_day: z.number().nullable().optional(),
  }),
  hourly: z
    .object({
      time: z.array(z.string()),
      precipitation_probability: z.array(z.number().nullable()),
      temperature_2m: series,
      weather_code: series,
      apparent_temperature: series,
      precipitation: series,
      wind_speed_10m: series,
      wind_gusts_10m: series,
      relative_humidity_2m: series,
      uv_index: series,
      is_day: series,
    })
    .optional(),
  daily: z
    .object({
      time: z.array(z.string()),
      weather_code: z.array(z.number().nullable()),
      temperature_2m_max: z.array(z.number().nullable()),
      temperature_2m_min: z.array(z.number().nullable()),
      precipitation_probability_max: z.array(z.number().nullable()),
      apparent_temperature_max: series,
      apparent_temperature_min: series,
      precipitation_sum: series,
      wind_speed_10m_max: series,
      wind_gusts_10m_max: series,
      uv_index_max: series,
      sunrise: stringSeries,
      sunset: stringSeries,
      sunshine_duration: series,
    })
    .optional(),
});

type Hourly = NonNullable<z.infer<typeof forecastSchema>['hourly']>;
type Daily = NonNullable<z.infer<typeof forecastSchema>['daily']>;
type Current = z.infer<typeof forecastSchema>['current'];

const round = (n: number | null | undefined): number | undefined =>
  n == null ? undefined : Math.round(n);
const round1 = (n: number | null | undefined): number | undefined =>
  n == null ? undefined : Math.round(n * 10) / 10;
/** "HH:mm" of an Open-Meteo local `YYYY-MM-DDTHH:mm`. */
const clock = (iso: string | null | undefined): string | undefined =>
  iso && iso.length >= 16 ? iso.slice(11, 16) : undefined;

function hourRowsOf(h: Hourly | undefined, nowIso: string): HourRow[] | undefined {
  if (!h?.temperature_2m || !h.weather_code) return undefined;
  const from = `${nowIso.slice(0, 13)}:00`;
  const rows: HourRow[] = [];
  h.time.forEach((time, i) => {
    const temp = h.temperature_2m![i];
    const code = h.weather_code![i];
    if (time < from || temp == null || code == null) return;
    const isDay = h.is_day?.[i];
    rows.push({
      time,
      temp: Math.round(temp),
      group: codeGroup(code),
      rain: Math.round(h.precipitation_probability[i] ?? 0),
      feels: round(h.apparent_temperature?.[i]),
      mm: round1(h.precipitation?.[i]),
      wind: round(h.wind_speed_10m?.[i]),
      gust: round(h.wind_gusts_10m?.[i]),
      hum: round(h.relative_humidity_2m?.[i]),
      uv: round1(h.uv_index?.[i]),
      night: isDay == null ? undefined : isDay === 0,
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
    const sun = d.sunshine_duration?.[i];
    rows.push({
      date,
      min: Math.round(min),
      max: Math.round(max),
      group: codeGroup(code),
      rain: Math.round(d.precipitation_probability_max[i] ?? 0),
      feelsMin: round(d.apparent_temperature_min?.[i]),
      feelsMax: round(d.apparent_temperature_max?.[i]),
      mm: round1(d.precipitation_sum?.[i]),
      wind: round(d.wind_speed_10m_max?.[i]),
      gust: round(d.wind_gusts_10m_max?.[i]),
      uv: round1(d.uv_index_max?.[i]),
      sunrise: clock(d.sunrise?.[i]),
      sunset: clock(d.sunset?.[i]),
      sunMin: sun == null ? undefined : Math.round(sun / 60),
    });
  });
  return rows;
}

function nowOf(c: Current): NowDetail | undefined {
  const out = {
    feels: round(c.apparent_temperature),
    hum: round(c.relative_humidity_2m),
    wind: round(c.wind_speed_10m),
    gust: round(c.wind_gusts_10m),
    night: c.is_day == null ? undefined : c.is_day === 0,
  };
  return Object.values(out).some((v) => v !== undefined) ? out : undefined;
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

export async function searchPlaces(query: string, f: Fetch = platformFetch): Promise<Place[]> {
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

export async function fetchForecast(
  lat: number,
  lon: number,
  f: Fetch = platformFetch,
): Promise<Forecast> {
  const url = `${FORECAST_URL}?${new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,is_day',
    hourly:
      'temperature_2m,weather_code,precipitation_probability,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,sunshine_duration',
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
    now: nowOf(c),
  };
}
