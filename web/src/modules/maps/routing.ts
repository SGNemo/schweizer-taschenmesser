/**
 * Routing through an OSRM service (the FOSSGIS instances of OpenStreetMap by default, changeable in the
 * module settings). Only on the user's click: the coordinates of start, stops and destination and the way of
 * travel go out, nothing else. Failures throw `MapsError`; the caller stays calm.
 */
import { z } from 'zod';
import { NetBlockedError } from '@/core/net/netlog';
import { getPlatform } from '@/core/platform';
import { MapsError } from './geocode';
import { DEFAULT_ROUTING_URL, roundCoord } from './logic';
import type { Endpoint, RouteMode } from './schema';

const TIMEOUT_MS = 12_000;
/** A line of this many points is plenty for a map; longer ones are thinned. */
const MAX_LINE_POINTS = 1500;

/** The way of travel an OSRM instance can do; public transport is a different service. */
export type DrivingMode = Exclude<RouteMode, 'transit'>;
export const isDrivingMode = (m: RouteMode): m is DrivingMode => m !== 'transit';
const PROFILE: Record<DrivingMode, string> = { walk: 'foot', bike: 'bike', car: 'car' };

export interface Step {
  /** Metres and seconds of this step. */
  distance: number;
  duration: number;
  type: string;
  modifier?: string;
  name?: string;
}

export interface Plan {
  /** Metres and seconds of the whole route. */
  distance: number;
  duration: number;
  line: { lat: number; lon: number }[];
  steps: Step[];
}

const planSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({
          coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())),
        }),
        legs: z
          .array(
            z.object({
              steps: z
                .array(
                  z.object({
                    distance: z.number(),
                    duration: z.number(),
                    name: z.string().optional(),
                    maneuver: z.object({ type: z.string(), modifier: z.string().optional() }),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

type Fetch = typeof fetch;
const platformFetch: Fetch = (input, init) => getPlatform().fetch(input, init);

/** Keeps the first and last point and about every n-th between, so a long route stays light to draw. */
export function thin<T>(points: readonly T[], max: number = MAX_LINE_POINTS): T[] {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max - 1; i++) out.push(points[Math.floor(i * step)]!);
  out.push(points[points.length - 1]!);
  return out;
}

/** The address of a route request (exported for the tests; the coordinates are `lon,lat`). */
export function routeUrl(template: string, mode: DrivingMode, points: readonly Endpoint[]): string {
  const base = template.replace('{profile}', PROFILE[mode]).replace(/\/+$/, '');
  const coords = points.map((p) => `${roundCoord(p.lon)},${roundCoord(p.lat)}`).join(';');
  return `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`;
}

/** Reads an OSRM answer; throws `MapsError('noroute')` when the service found none. */
export function parsePlan(body: unknown): Plan {
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) throw new MapsError('shape');
  const { code, routes } = parsed.data;
  if (code === 'NoRoute') throw new MapsError('noroute');
  const route = routes?.[0];
  if (code !== 'Ok' || !route) throw new MapsError(code === 'Ok' ? 'shape' : code);
  const line = route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
  const steps = (route.legs ?? []).flatMap((leg) =>
    (leg.steps ?? []).map((s) => ({
      distance: s.distance,
      duration: s.duration,
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      name: s.name?.trim() || undefined,
    })),
  );
  return { distance: route.distance, duration: route.duration, line: thin(line), steps };
}

/** Asks the routing service. At least a start and a destination (and up to three stops between). */
export async function fetchPlan(
  mode: DrivingMode,
  points: readonly Endpoint[],
  opts: { template?: string; fetch?: Fetch } = {},
): Promise<Plan> {
  if (points.length < 2 || points.length > 5) throw new MapsError('points');
  const url = routeUrl(opts.template ?? DEFAULT_ROUTING_URL, mode, points);
  let body: unknown;
  try {
    const res = await (opts.fetch ?? platformFetch)(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // OSRM answers "no route" with a 400 and a JSON body: read it before judging the status.
    body = await res.json().catch(() => undefined);
    if (!res.ok && (body as { code?: string } | undefined)?.code !== 'NoRoute')
      throw new MapsError(`http ${res.status}`);
  } catch (e) {
    throw e instanceof MapsError
      ? e
      : new MapsError(e instanceof NetBlockedError ? 'blocked' : 'network');
  }
  return parsePlan(body);
}

/* ------------------------------------------------------------------ text of a step (pure) */

export type StepKind = 'depart' | 'arrive' | 'turn' | 'roundabout' | 'continue';
export type Direction =
  | 'left'
  | 'right'
  | 'slightLeft'
  | 'slightRight'
  | 'sharpLeft'
  | 'sharpRight'
  | 'straight'
  | 'uturn';

const DIRECTION: Record<string, Direction> = {
  left: 'left',
  right: 'right',
  'slight left': 'slightLeft',
  'slight right': 'slightRight',
  'sharp left': 'sharpLeft',
  'sharp right': 'sharpRight',
  straight: 'straight',
  uturn: 'uturn',
};

/** What a step means, without words: the page turns it into a sentence in the UI language. */
export function describeStep(step: Step): { kind: StepKind; direction?: Direction; name?: string } {
  const direction = step.modifier ? DIRECTION[step.modifier] : undefined;
  switch (step.type) {
    case 'depart':
      return { kind: 'depart', direction, name: step.name };
    case 'arrive':
      return { kind: 'arrive', direction };
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
    case 'exit roundabout':
    case 'exit rotary':
      return { kind: 'roundabout', name: step.name };
    case 'new name':
    case 'continue':
      return { kind: 'continue', direction: direction ?? 'straight', name: step.name };
    default:
      return { kind: 'turn', direction: direction ?? 'straight', name: step.name };
  }
}

/** Hours and minutes (at least one minute) of a duration in seconds. */
export function splitDuration(seconds: number): { h: number; m: number } {
  const total = Math.max(1, Math.round(seconds / 60));
  return { h: Math.floor(total / 60), m: total % 60 };
}
