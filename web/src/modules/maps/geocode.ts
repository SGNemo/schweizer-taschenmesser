/**
 * Place search through a Nominatim-compatible service (OpenStreetMap's by default, changeable in the
 * module settings). Only the typed words and the UI language go out, only when the user submits.
 * Failures throw `MapsError`; the caller stays calm.
 */
import { z } from 'zod';
import { getPlatform } from '@/core/platform';
import { identify } from './agent';
import { DEFAULT_SEARCH_URL, parseCoordinates, roundCoord } from './logic';
import type { Bbox } from './own/cut';

const TIMEOUT_MS = 8000;
/** Nominatim's usage policy: at most one request per second. */
const MIN_GAP_MS = 1100;

export class MapsError extends Error {
  constructor(message = 'maps') {
    super(message);
    this.name = 'MapsError';
  }
}

export interface Hit {
  label: string;
  lat: number;
  lon: number;
  /** The area of the hit (a town, a district), when the service names one: the own map builds it. */
  bbox?: Bbox;
}

const coord = z.union([z.string(), z.number()]);
const hitsSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: coord,
    lon: coord,
    boundingbox: z.array(coord).optional(),
  }),
);

/** Nominatim's `[south, north, west, east]` → bbox, or undefined when it is not sane. */
export function bboxOf(box: readonly (string | number)[] | undefined): Bbox | undefined {
  if (!box || box.length !== 4) return undefined;
  const [s, n, w, e] = box.map(Number) as [number, number, number, number];
  if (![s, n, w, e].every(Number.isFinite)) return undefined;
  if (
    s >= n ||
    w >= e ||
    Math.abs(s) > 90 ||
    Math.abs(n) > 90 ||
    Math.abs(w) > 180 ||
    Math.abs(e) > 180
  )
    return undefined;
  return {
    minLat: roundCoord(s),
    maxLat: roundCoord(n),
    minLon: roundCoord(w),
    maxLon: roundCoord(e),
  };
}

type Fetch = typeof fetch;
const platformFetch: Fetch = (input, init) => getPlatform().fetch(input, init);

let lastAt = 0;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Open-Meteo-style calm: coordinates need no service at all, anything else asks the search service. */
export async function searchPlaces(
  query: string,
  opts: { baseUrl?: string; lang: string; fetch?: Fetch; clock?: () => number },
): Promise<Hit[]> {
  const words = query.trim().slice(0, 120);
  if (words.length < 2) return [];
  const coords = parseCoordinates(words);
  if (coords) {
    return [
      {
        label: `${roundCoord(coords.lat)}, ${roundCoord(coords.lon)}`,
        lat: roundCoord(coords.lat),
        lon: roundCoord(coords.lon),
      },
    ];
  }
  const f = opts.fetch ?? platformFetch;
  const now = opts.clock ?? Date.now;
  const gap = lastAt + MIN_GAP_MS - now();
  if (gap > 0 && !opts.fetch) await wait(gap);
  lastAt = now();
  const base = opts.baseUrl ?? DEFAULT_SEARCH_URL;
  const params = new URLSearchParams({
    q: words,
    format: 'jsonv2',
    limit: '6',
    'accept-language': opts.lang,
  });
  const url = `${base}${base.includes('?') ? '&' : '?'}${params}`;
  let body: unknown;
  try {
    const res = await f(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...identify() });
    if (!res.ok) throw new MapsError(`http ${res.status}`);
    body = await res.json();
  } catch (e) {
    throw e instanceof MapsError ? e : new MapsError('network');
  }
  const parsed = hitsSchema.safeParse(body);
  if (!parsed.success) throw new MapsError('shape');
  return parsed.data.flatMap((h) => {
    const lat = Number(h.lat);
    const lon = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
      return [];
    const bbox = bboxOf(h.boundingbox);
    return [
      {
        label: h.display_name.trim().slice(0, 160),
        lat: roundCoord(lat),
        lon: roundCoord(lon),
        ...(bbox ? { bbox } : {}),
      },
    ];
  });
}
