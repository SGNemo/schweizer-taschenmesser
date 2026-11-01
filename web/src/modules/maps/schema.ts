import { z } from 'zod';

export const PLACE_CATEGORIES = ['home', 'work', 'shop', 'health', 'leisure', 'other'] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const ROUTE_MODES = ['walk', 'bike', 'car', 'transit'] as const;
export type RouteMode = (typeof ROUTE_MODES)[number];

const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);

/** One end of a route: copied from a place or a search hit, so a deleted place never breaks a route. */
export const endpointSchema = z.object({
  label: z.string().min(1),
  lat,
  lon,
});
export type Endpoint = z.output<typeof endpointSchema>;

/** A saved place. Coordinates in decimal degrees (WGS 84). */
export const placeSchema = z.object({
  name: z.string().min(1),
  lat,
  lon,
  address: z.string().optional(),
  note: z.string().optional(),
  category: z.enum(PLACE_CATEGORIES).default('other'),
  pinned: z.boolean().default(false),
});
export type Place = z.output<typeof placeSchema>;

/** A route used often: from, optional stops, to and how you travel. Opened in the map or an app of your choice. */
export const routeSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(ROUTE_MODES).default('walk'),
  from: endpointSchema,
  to: endpointSchema,
  via: z.array(endpointSchema).max(3).default([]),
  note: z.string().optional(),
  pinned: z.boolean().default(false),
});
export type Route = z.output<typeof routeSchema>;

/* ------------------------------------------------------------------ own map (device-local, never synced) */

export const MAP_LEVELS = ['lean', 'full'] as const;
export type MapLevel = (typeof MAP_LEVELS)[number];
export const REGION_STATUS = ['building', 'paused', 'done', 'error'] as const;
export type RegionStatus = (typeof REGION_STATUS)[number];
/** Why a build paused by itself (a busy or unreachable server, a blocked network, an unreadable answer). */
export const PAUSE_REASONS = ['busy', 'network', 'blocked', 'error'] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

const zoom = z.number().int().min(0).max(22);
export const bboxSchema = z.object({ minLat: lat, minLon: lon, maxLat: lat, maxLon: lon });
export type Bbox = z.output<typeof bboxSchema>;

/**
 * A built area of the own map: where, how detailed (`level`), which tile zooms are stored, how far the
 * build got. A cache, not user data: `local: true` in the manifest (no sync, no backup, no data API, no AI).
 */
export const regionSchema = z.object({
  name: z.string().min(1),
  bbox: bboxSchema,
  level: z.enum(MAP_LEVELS).default('lean'),
  zooms: z.object({ min: zoom, max: zoom }),
  cells: z
    .object({ done: z.number().int().min(0), total: z.number().int().min(0) })
    .default({ done: 0, total: 0 }),
  status: z.enum(REGION_STATUS).default('done'),
  reason: z.enum(PAUSE_REASONS).optional(),
  /** Zoom of the build cells (one request each); the cell order is derived from it on resume. */
  cellZoom: zoom.default(13),
  /** Epoch ms of the last finished build (a technical timestamp, shown as a date). */
  builtAt: z.number().int().optional(),
  /** Stored bytes of all its tiles. */
  bytes: z.number().int().min(0).default(0),
  /** Where the data came from (for the credit line). */
  source: z.string().optional(),
});
export type Region = z.output<typeof regionSchema>;

/** One stored tile of the own map, id `z/x/y`: Mapbox Vector Tile bytes, gzip when `gzip` is set. */
export const tileSchema = z.object({
  regionId: z.string().min(1),
  z: zoom,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  bytes: z.instanceof(ArrayBuffer),
  gzip: z.boolean().default(false),
  size: z.number().int().min(0),
});
export type Tile = z.output<typeof tileSchema>;
