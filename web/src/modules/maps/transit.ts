/**
 * Public transport connections through a MOTIS service (Transitous by default, changeable in the module
 * settings). Only on the user's click: start, destination and the departure time go out, nothing else.
 * Failures throw `MapsError`. The answer is read defensively (optional fields) and never stored.
 */
import { z } from 'zod';
import { NetBlockedError } from '@/core/net/netlog';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { MapsError } from './geocode';
import { DEFAULT_TRANSIT_URL, roundCoord } from './logic';
import { thin } from './routing';
import type { Endpoint } from './schema';

const TIMEOUT_MS = 15_000;
const MAX_ITINERARIES = 3;

export type LegKind = 'walk' | 'train' | 'bus' | 'tram' | 'other';

export interface Stop {
  name: string;
  lat: number;
  lon: number;
}

export interface Leg {
  kind: LegKind;
  /** Line label ("S1", "Bus 30"), when the leg is a ride. */
  line?: string;
  headsign?: string;
  from: Stop;
  to: Stop;
  /** ISO times. */
  start: string;
  end: string;
  path: { lat: number; lon: number }[];
}

export interface Connection {
  start: string;
  end: string;
  /** Seconds. */
  duration: number;
  transfers: number;
  legs: Leg[];
}

const placeSchema = z.object({
  name: z.string().optional(),
  lat: z.number(),
  lon: z.number(),
});
const legSchema = z.object({
  mode: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  from: placeSchema,
  to: placeSchema,
  routeShortName: z.string().optional(),
  displayName: z.string().optional(),
  headsign: z.string().optional(),
  legGeometry: z.object({ points: z.string(), precision: z.number().optional() }).optional(),
});
const answerSchema = z.object({
  itineraries: z
    .array(
      z.object({
        duration: z.number(),
        startTime: z.string(),
        endTime: z.string(),
        transfers: z.number().optional(),
        legs: z.array(legSchema),
      }),
    )
    .optional(),
});

type Fetch = typeof fetch;
const platformFetch: Fetch = (input, init) => getPlatform().fetch(input, init);

/** Google's encoded polyline, with the precision the service states (MOTIS: 6 or 7). */
export function decodePolyline(encoded: string, precision = 7): { lat: number; lon: number }[] {
  const factor = 10 ** precision;
  const out: { lat: number; lon: number }[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = (): number | undefined => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (i >= encoded.length) return undefined;
      byte = encoded.charCodeAt(i++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    const dLat = next();
    const dLon = next();
    if (dLat === undefined || dLon === undefined) break;
    lat += dLat;
    lon += dLon;
    out.push({ lat: lat / factor, lon: lon / factor });
  }
  return out;
}

const RAIL = /RAIL|TRAIN|SUBWAY|METRO|FUNICULAR|MONORAIL/;
export function legKind(mode: string): LegKind {
  const m = mode.toUpperCase();
  if (m === 'WALK' || m === 'BIKE' || m === 'CAR' || m === 'FLEX') return 'walk';
  if (m === 'TRAM') return 'tram';
  if (m === 'BUS' || m === 'COACH') return 'bus';
  if (RAIL.test(m)) return 'train';
  return 'other';
}

/** The address of a request (exported for the tests). `time` is an ISO instant. */
export function transitUrl(template: string, from: Endpoint, to: Endpoint, time: Date): string {
  const base = template.replace(/\/+$/, '');
  const q = new URLSearchParams({
    fromPlace: `${roundCoord(from.lat)},${roundCoord(from.lon)}`,
    toPlace: `${roundCoord(to.lat)},${roundCoord(to.lon)}`,
    time: time.toISOString(),
    numItineraries: String(MAX_ITINERARIES),
  });
  return `${base}/plan?${q.toString()}`;
}

/** Reads a MOTIS answer; throws `MapsError('noroute')` when it holds no connection. */
export function parseConnections(body: unknown): Connection[] {
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) throw new MapsError('shape');
  const found = (parsed.data.itineraries ?? []).slice(0, MAX_ITINERARIES);
  if (found.length === 0) throw new MapsError('noroute');
  return found.map((it) => {
    const legs: Leg[] = it.legs.map((l) => {
      const from = { name: l.from.name?.trim() ?? '', lat: l.from.lat, lon: l.from.lon };
      const to = { name: l.to.name?.trim() ?? '', lat: l.to.lat, lon: l.to.lon };
      const decoded = l.legGeometry
        ? decodePolyline(l.legGeometry.points, l.legGeometry.precision ?? 7)
        : [];
      return {
        kind: legKind(l.mode),
        line: l.routeShortName?.trim() || l.displayName?.trim() || undefined,
        headsign: l.headsign?.trim() || undefined,
        from,
        to,
        start: l.startTime,
        end: l.endTime,
        path: thin(decoded.length > 1 ? decoded : [from, to], 400),
      } as Leg;
    });
    const rides = legs.filter((l) => l.kind !== 'walk').length;
    return {
      start: it.startTime,
      end: it.endTime,
      duration: it.duration,
      transfers: it.transfers ?? Math.max(0, rides - 1),
      legs,
    };
  });
}

export async function fetchConnections(
  from: Endpoint,
  to: Endpoint,
  opts: { template?: string; fetch?: Fetch; at?: Date } = {},
): Promise<Connection[]> {
  const url = transitUrl(
    opts.template ?? DEFAULT_TRANSIT_URL,
    from,
    to,
    opts.at ?? new Date(now()),
  );
  let body: unknown;
  try {
    const res = await (opts.fetch ?? platformFetch)(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new MapsError(`http ${res.status}`);
    body = await res.json();
  } catch (e) {
    throw e instanceof MapsError
      ? e
      : new MapsError(e instanceof NetBlockedError ? 'blocked' : 'network');
  }
  return parseConnections(body);
}

/** The whole path of a connection for the map. */
export const connectionPath = (c: Connection): { lat: number; lon: number }[] =>
  c.legs.flatMap((l) => l.path);
