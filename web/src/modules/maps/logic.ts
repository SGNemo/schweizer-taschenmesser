/**
 * Pure helpers of the maps module: Web Mercator tile maths, distances, coordinate input and the links
 * that open a place or route in other map apps. No network, no storage.
 */
import type { Endpoint, RouteMode } from './schema';

/** Default services (OpenStreetMap). Here, not in the files that talk to the network, so the manifest never pulls the platform in. */
export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

export const TILE_SIZE = 256;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 19;
/** Web Mercator cannot show the poles. */
const MAX_LAT = 85.0511;

export interface View {
  lat: number;
  lon: number;
  /** May be fractional while pinching; tiles come from the nearest whole level. */
  zoom: number;
}

export interface Point {
  x: number;
  y: number;
}

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const clampLat = (lat: number): number => Math.min(MAX_LAT, Math.max(-MAX_LAT, lat));
export const wrapLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** World pixel (at `zoom`) of a position. */
export function project(lat: number, lon: number, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/** Position of a world pixel at `zoom`. */
export function unproject(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lon: wrapLon((x / scale) * 360 - 180),
  };
}

/** The view after dragging by `dx`, `dy` screen pixels. */
export function panBy(view: View, dx: number, dy: number): View {
  const c = project(view.lat, view.lon, view.zoom);
  const next = unproject(c.x - dx, c.y - dy, view.zoom);
  return { ...view, lat: clampLat(next.lat), lon: next.lon };
}

/**
 * The view after zooming to `zoom` while the point under screen position (`px`, `py`) stays put
 * (`width`, `height` = size of the map element).
 */
export function zoomAt(
  view: View,
  zoom: number,
  px: number,
  py: number,
  width: number,
  height: number,
): View {
  const z = clampZoom(zoom);
  const c = project(view.lat, view.lon, view.zoom);
  const worldX = c.x + (px - width / 2);
  const worldY = c.y + (py - height / 2);
  const ratio = 2 ** (z - view.zoom);
  const next = unproject(worldX * ratio - (px - width / 2), worldY * ratio - (py - height / 2), z);
  return { lat: clampLat(next.lat), lon: next.lon, zoom: z };
}

/** Screen position of a place inside the map element. */
export function toScreen(
  view: View,
  lat: number,
  lon: number,
  width: number,
  height: number,
): Point {
  const c = project(view.lat, view.lon, view.zoom);
  const p = project(lat, lon, view.zoom);
  return { x: p.x - c.x + width / 2, y: p.y - c.y + height / 2 };
}

/** Position under a screen point. */
export function fromScreen(
  view: View,
  px: number,
  py: number,
  width: number,
  height: number,
): { lat: number; lon: number } {
  const c = project(view.lat, view.lon, view.zoom);
  return unproject(c.x + (px - width / 2), c.y + (py - height / 2), view.zoom);
}

export interface TileSpec {
  /** Tile level (whole). */
  z: number;
  x: number;
  y: number;
  /** Left / top of the tile in the map element, already scaled for a fractional zoom. */
  left: number;
  top: number;
  size: number;
}

/** The tiles that cover the map element, with their screen rectangles. */
export function visibleTiles(view: View, width: number, height: number): TileSpec[] {
  const z = Math.min(MAX_ZOOM, Math.max(0, Math.round(view.zoom)));
  const ratio = 2 ** (view.zoom - z);
  const size = TILE_SIZE * ratio;
  const c = project(view.lat, view.lon, z);
  const centerX = c.x * ratio;
  const centerY = c.y * ratio;
  const n = 2 ** z;
  const x0 = Math.floor((centerX - width / 2) / size);
  const x1 = Math.floor((centerX + width / 2) / size);
  const y0 = Math.max(0, Math.floor((centerY - height / 2) / size));
  const y1 = Math.min(n - 1, Math.floor((centerY + height / 2) / size));
  const tiles: TileSpec[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({
        z,
        x: ((tx % n) + n) % n,
        y: ty,
        left: tx * size - centerX + width / 2,
        top: ty * size - centerY + height / 2,
        size,
      });
    }
  }
  return tiles;
}

/** The view that shows all of the given points (a single point: a street-level view). */
export function fitView(
  points: readonly { lat: number; lon: number }[],
  width: number,
  height: number,
  padding = 48,
): View | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const lat = (minLat + maxLat) / 2;
  const lon = (minLon + maxLon) / 2;
  if (minLat === maxLat && minLon === maxLon) return { lat, lon, zoom: 15 };
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom--) {
    const a = project(maxLat, minLon, zoom);
    const b = project(minLat, maxLon, zoom);
    if (b.x - a.x <= width - 2 * padding && b.y - a.y <= height - 2 * padding)
      return { lat, lon, zoom };
  }
  return { lat, lon, zoom: MIN_ZOOM };
}

/* ------------------------------------------------------------------ distances and coordinates */

const EARTH_M = 6_371_000;

/** Great-circle distance in metres. */
export function distanceMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * "49.5981, 11.0044", "49.5981 11.0044" or "49,5981; 11,0044" → coordinates; `undefined` for anything else
 * or out-of-range numbers.
 */
export function parseCoordinates(input: string): { lat: number; lon: number } | undefined {
  const m = /^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[;,\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/.exec(input);
  if (!m) return undefined;
  const lat = Number(m[1]!.replace(',', '.'));
  const lon = Number(m[2]!.replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
}

/** Five decimals (about a metre) – what is stored and shown. */
export const roundCoord = (n: number): number => Math.round(n * 1e5) / 1e5;

/* ------------------------------------------------------------------ links to other apps */

export type MapApp = 'osm' | 'google' | 'apple' | 'geo';
export const MAP_APPS: readonly MapApp[] = ['osm', 'google', 'apple', 'geo'];

const pair = (p: { lat: number; lon: number }): string =>
  `${roundCoord(p.lat)},${roundCoord(p.lon)}`;

/** Link that shows one position in another map app (`geo:` opens the phone's own choice). */
export function placeLink(app: MapApp, p: { lat: number; lon: number; label?: string }): string {
  const q = pair(p);
  switch (app) {
    case 'osm':
      return `https://www.openstreetmap.org/?mlat=${roundCoord(p.lat)}&mlon=${roundCoord(p.lon)}#map=17/${roundCoord(p.lat)}/${roundCoord(p.lon)}`;
    case 'google':
      return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case 'apple':
      return `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent(p.label ?? q)}`;
    case 'geo':
      return `geo:${q}?q=${q}${p.label ? `(${encodeURIComponent(p.label)})` : ''}`;
  }
}

const OSM_ENGINE: Record<Exclude<RouteMode, 'transit'>, string> = {
  walk: 'fossgis_osrm_foot',
  bike: 'fossgis_osrm_bike',
  car: 'fossgis_osrm_car',
};
const GOOGLE_MODE: Record<RouteMode, string> = {
  walk: 'walking',
  bike: 'bicycling',
  car: 'driving',
  transit: 'transit',
};
const APPLE_MODE: Record<RouteMode, string> = { walk: 'w', bike: 'w', car: 'd', transit: 'r' };

/**
 * Link that opens the route in another map app. OpenStreetMap has no public transport routing: the
 * route is then opened without a mode (`null` = this app cannot do it, the caller hides the entry).
 * Stops are only passed where the app takes them (Google Maps).
 */
export function routeLink(
  app: MapApp,
  mode: RouteMode,
  from: Endpoint,
  to: Endpoint,
  via: readonly Endpoint[] = [],
): string | null {
  switch (app) {
    case 'osm':
      return mode === 'transit'
        ? null
        : `https://www.openstreetmap.org/directions?engine=${OSM_ENGINE[mode]}&route=${pair(from)};${pair(to)}`;
    case 'google': {
      const params = new URLSearchParams({
        api: '1',
        origin: pair(from),
        destination: pair(to),
        travelmode: GOOGLE_MODE[mode],
      });
      if (via.length > 0) params.set('waypoints', via.map(pair).join('|'));
      return `https://www.google.com/maps/dir/?${params}`;
    }
    case 'apple':
      return `https://maps.apple.com/?saddr=${pair(from)}&daddr=${pair(to)}&dirflg=${APPLE_MODE[mode]}`;
    case 'geo':
      return null;
  }
}

/** "850 m" / "3,4 km" / "12 km" (the decimal mark of the UI language comes from the caller). */
export function formatDistance(
  meters: number,
  fmt: (n: number) => string = (n) => String(n),
): { value: string; unit: 'm' | 'km' } {
  if (meters < 1000) return { value: fmt(Math.round(meters / 10) * 10), unit: 'm' };
  return {
    value: fmt(meters < 10_000 ? Math.round(meters / 100) / 10 : Math.round(meters / 1000)),
    unit: 'km',
  };
}

/** Whether an https template can be a tile URL (`{z}`, `{x}`, `{y}`) or a search endpoint (https only). */
export const isTileTemplate = (url: string): boolean =>
  /^https:\/\/[^\s/]+\/\S*\{z\}\S*\{x\}\S*\{y\}\S*$/.test(url) ||
  /^https:\/\/[^\s/]+\/\S*\{z\}\S*\{y\}\S*\{x\}\S*$/.test(url);
export const isHttpsUrl = (url: string): boolean => /^https:\/\/[^\s/]+(\/\S*)?$/.test(url);

/** Fills a tile template. */
export const tileUrl = (template: string, z: number, x: number, y: number): string =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
