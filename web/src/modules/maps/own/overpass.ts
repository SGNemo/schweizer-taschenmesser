/**
 * Overpass API: the query for one cell and the parser of its JSON answer (`out geom`) into the
 * features the cutter takes. Pure and relative imports only (the build worker and the tests use it).
 * Nothing here talks to the network; the builder does, through the platform fetch.
 *
 * Only tags that the style table draws are kept: the stored map holds no names of people, no
 * addresses, nothing beyond what any map shows.
 */
import type { MapLevel } from '../schema';
import type { Bbox, Feature, LonLat } from './cut';
import type { TileValue } from './mvt';

export const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
/** Server-side limits per request: seconds and bytes (64 MiB). */
const TIMEOUT_S = 60;
const MAXSIZE = 67_108_864;

/* ------------------------------------------------------------------ query */

const ROADS_LEAN =
  '^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|pedestrian)$';
const ROADS_FULL =
  '^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|pedestrian|service|track|path|footway|cycleway|bridleway|steps)$';
const RAIL = '^(rail|light_rail|tram|subway|narrow_gauge)$';
const WATERWAY = '^(river|canal|stream)$';
const LANDUSE = '^(forest|residential|industrial|commercial|retail|cemetery|grass|meadow)$';
const LEISURE = '^(park|garden|pitch|playground)$';
const PLACE = '^(city|town|village|suburb|hamlet|neighbourhood|quarter)$';
const POI_AMENITY =
  '^(cafe|restaurant|pharmacy|doctors|hospital|school|kindergarten|library|bank|post_office|townhall|place_of_worship|fuel)$';

const bboxOf = (b: Bbox): string =>
  `${b.minLat.toFixed(5)},${b.minLon.toFixed(5)},${b.maxLat.toFixed(5)},${b.maxLon.toFixed(5)}`;

/** The Overpass QL query of one cell: lean = what the lean map shows; full adds paths, buildings, POIs. */
export function overpassQuery(bbox: Bbox, level: MapLevel): string {
  const b = bboxOf(bbox);
  const lines = [
    `way["highway"~"${level === 'full' ? ROADS_FULL : ROADS_LEAN}"](${b});`,
    `way["railway"~"${RAIL}"](${b});`,
    `way["waterway"~"${WATERWAY}"](${b});`,
    `way["natural"="water"](${b});`,
    `relation["natural"="water"]["type"="multipolygon"](${b});`,
    `way["natural"="wood"](${b});`,
    `relation["natural"="wood"]["type"="multipolygon"](${b});`,
    `way["landuse"~"${LANDUSE}"](${b});`,
    `relation["landuse"~"${LANDUSE}"]["type"="multipolygon"](${b});`,
    `way["leisure"~"${LEISURE}"](${b});`,
    `node["place"~"${PLACE}"](${b});`,
  ];
  if (level === 'full') {
    lines.push(
      `way["building"](${b});`,
      `node["amenity"~"${POI_AMENITY}"]["name"](${b});`,
      `node["shop"]["name"](${b});`,
      `node["public_transport"="station"]["name"](${b});`,
      `node["railway"="station"]["name"](${b});`,
      `node["tourism"~"^(attraction|museum|viewpoint)$"]["name"](${b});`,
    );
  }
  return `[out:json][timeout:${TIMEOUT_S}][maxsize:${MAXSIZE}];\n(\n  ${lines.join('\n  ')}\n);\nout geom;`;
}

/* ------------------------------------------------------------------ parsing */

interface OsmPoint {
  lat: number;
  lon: number;
}
interface OsmMember {
  type: string;
  ref?: number;
  role?: string;
  geometry?: OsmPoint[];
}
interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  geometry?: (OsmPoint | null)[];
  members?: OsmMember[];
}

export interface OverpassAnswer {
  elements: OsmElement[];
  remark?: string;
}

const isPoint = (p: unknown): p is OsmPoint =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as OsmPoint).lat === 'number' &&
  typeof (p as OsmPoint).lon === 'number';

/** Throws on anything that is not an Overpass JSON answer. */
export function readAnswer(json: unknown): OverpassAnswer {
  if (typeof json !== 'object' || json === null) throw new Error('overpass: not an object');
  const a = json as { elements?: unknown; remark?: unknown };
  if (!Array.isArray(a.elements)) throw new Error('overpass: no elements');
  return {
    elements: a.elements.filter(
      (e): e is OsmElement =>
        typeof e === 'object' && e !== null && typeof (e as OsmElement).id === 'number',
    ),
    ...(typeof a.remark === 'string' ? { remark: a.remark } : {}),
  };
}

/** A `remark` that says the server ran out of time or memory: the request has to be tried again later. */
export const isOverloadRemark = (remark: string | undefined): boolean =>
  /timed? ?out|out of memory|load|too busy|rate_limited/i.test(remark ?? '');

const ROAD_CLASS: Record<string, string> = {
  motorway: 'motorway',
  motorway_link: 'motorway',
  trunk: 'trunk',
  trunk_link: 'trunk',
  primary: 'primary',
  primary_link: 'primary',
  secondary: 'secondary',
  secondary_link: 'secondary',
  tertiary: 'tertiary',
  tertiary_link: 'tertiary',
  unclassified: 'residential',
  residential: 'residential',
  living_street: 'living',
  pedestrian: 'pedestrian',
  service: 'service',
  track: 'track',
  path: 'path',
  footway: 'path',
  bridleway: 'path',
  cycleway: 'cycleway',
  steps: 'steps',
};
const ROAD_MIN_ZOOM: Record<string, number> = {
  motorway: 7,
  trunk: 8,
  primary: 9,
  secondary: 10,
  tertiary: 11,
  residential: 12,
  living: 13,
  pedestrian: 13,
  service: 14,
  track: 14,
  path: 14,
  cycleway: 14,
  steps: 15,
};
const LANDUSE_CLASS: Record<string, string> = {
  forest: 'forest',
  wood: 'forest',
  residential: 'residential',
  industrial: 'industrial',
  commercial: 'commercial',
  retail: 'commercial',
  cemetery: 'cemetery',
  grass: 'grass',
  meadow: 'grass',
  park: 'park',
  garden: 'park',
  pitch: 'grass',
  playground: 'grass',
};
const PLACE_MIN_ZOOM: Record<string, number> = {
  city: 6,
  town: 8,
  village: 10,
  suburb: 12,
  quarter: 12,
  hamlet: 13,
  neighbourhood: 14,
};
const POI_CLASS = (tags: Record<string, string>): string | undefined => {
  if (tags.shop) return 'shop';
  if (tags.railway === 'station' || tags.public_transport === 'station') return 'transport';
  if (tags.tourism) return 'tourism';
  const a = tags.amenity;
  if (!a) return undefined;
  if (['cafe', 'restaurant'].includes(a)) return 'food';
  if (['pharmacy', 'doctors', 'hospital'].includes(a)) return 'health';
  if (['school', 'kindergarten', 'library'].includes(a)) return 'education';
  return 'amenity';
};

/** Node id, way id and relation id live in different spaces: one number for all three. */
const featureId = (type: string, id: number): number =>
  id * 4 + (type === 'node' ? 0 : type === 'way' ? 1 : 2);

const named = (tags: Record<string, string>, cls: string): Record<string, TileValue> =>
  tags.name ? { class: cls, name: tags.name } : { class: cls };

const closed = (pts: LonLat[]): boolean =>
  pts.length > 3 &&
  pts[0]!.lat === pts[pts.length - 1]!.lat &&
  pts[0]!.lon === pts[pts.length - 1]!.lon;

/** The area class of tags (landuse, leisure, natural, water), or undefined when it is not an area we draw. */
function areaOf(
  tags: Record<string, string>,
): { layer: string; cls: string; minZoom: number } | undefined {
  if (tags.natural === 'water' || tags.water) {
    return { layer: 'water', cls: tags.water === 'river' ? 'river' : 'lake', minZoom: 6 };
  }
  if (tags.natural === 'wood') return { layer: 'landuse', cls: 'forest', minZoom: 8 };
  const lu = tags.landuse ? LANDUSE_CLASS[tags.landuse] : undefined;
  if (lu) return { layer: 'landuse', cls: lu, minZoom: lu === 'forest' ? 8 : 11 };
  const le = tags.leisure ? LANDUSE_CLASS[tags.leisure] : undefined;
  if (le) return { layer: 'landuse', cls: le, minZoom: 11 };
  if (tags.building)
    return {
      layer: 'building',
      cls: tags.building === 'yes' ? 'house' : tags.building,
      minZoom: 14,
    };
  return undefined;
}

function wayFeature(e: OsmElement): Feature | undefined {
  const tags = e.tags ?? {};
  const pts = (e.geometry ?? []).filter(isPoint).map((p) => ({ lat: p.lat, lon: p.lon }));
  if (pts.length < 2) return undefined;
  const id = featureId('way', e.id);
  const road = tags.highway ? ROAD_CLASS[tags.highway] : undefined;
  if (road) {
    return {
      layer: 'road',
      type: 'line',
      coords: [pts],
      tags: named(tags, road),
      id,
      minZoom: ROAD_MIN_ZOOM[road] ?? 13,
    };
  }
  if (tags.railway && /^(rail|light_rail|tram|subway|narrow_gauge)$/.test(tags.railway)) {
    const cls = tags.railway === 'narrow_gauge' ? 'rail' : tags.railway;
    return { layer: 'rail', type: 'line', coords: [pts], tags: { class: cls }, id, minZoom: 10 };
  }
  if (tags.waterway && /^(river|canal|stream)$/.test(tags.waterway)) {
    const minZoom = tags.waterway === 'river' ? 9 : tags.waterway === 'canal' ? 11 : 13;
    return {
      layer: 'waterway',
      type: 'line',
      coords: [pts],
      tags: named(tags, tags.waterway),
      id,
      minZoom,
    };
  }
  const area = areaOf(tags);
  if (area && closed(pts)) {
    return {
      layer: area.layer,
      type: 'polygon',
      coords: [pts],
      tags: named(tags, area.cls),
      id,
      minZoom: area.minZoom,
    };
  }
  return undefined;
}

function nodeFeature(e: OsmElement): Feature | undefined {
  const tags = e.tags ?? {};
  if (typeof e.lat !== 'number' || typeof e.lon !== 'number') return undefined;
  const id = featureId('node', e.id);
  const p = { lat: e.lat, lon: e.lon };
  if (tags.place && PLACE_MIN_ZOOM[tags.place] !== undefined && tags.name) {
    return {
      layer: 'place',
      type: 'point',
      coords: [[p]],
      tags: named(tags, tags.place),
      id,
      minZoom: PLACE_MIN_ZOOM[tags.place]!,
    };
  }
  const poi = POI_CLASS(tags);
  if (poi && tags.name) {
    return { layer: 'poi', type: 'point', coords: [[p]], tags: named(tags, poi), id, minZoom: 15 };
  }
  return undefined;
}

/** Joins member ways end to end into closed rings (an unclosed leftover is dropped). */
export function assembleRings(parts: LonLat[][]): LonLat[][] {
  const same = (a: LonLat, b: LonLat) => a.lat === b.lat && a.lon === b.lon;
  const open = parts.filter((p) => p.length > 1).map((p) => p.slice());
  const rings: LonLat[][] = [];
  while (open.length > 0) {
    const ring = open.shift()!;
    let grown = true;
    while (!same(ring[0]!, ring[ring.length - 1]!) && grown) {
      grown = false;
      const end = ring[ring.length - 1]!;
      for (let i = 0; i < open.length; i++) {
        const cand = open[i]!;
        if (same(cand[0]!, end)) ring.push(...cand.slice(1));
        else if (same(cand[cand.length - 1]!, end)) ring.push(...cand.slice(0, -1).reverse());
        else continue;
        open.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (same(ring[0]!, ring[ring.length - 1]!) && ring.length > 3) rings.push(ring);
  }
  return rings;
}

/** Even-odd point in polygon. */
function inside(p: LonLat, ring: LonLat[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (
      a.lat > p.lat !== b.lat > p.lat &&
      p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon
    )
      hit = !hit;
  }
  return hit;
}

function relationFeatures(e: OsmElement): Feature[] {
  const tags = e.tags ?? {};
  const area = areaOf(tags);
  if (!area || !e.members) return [];
  const byRole = (role: string) =>
    e
      .members!.filter(
        (m) => m.type === 'way' && (m.role ?? 'outer') === role && Array.isArray(m.geometry),
      )
      .map((m) => m.geometry!.filter(isPoint).map((p) => ({ lat: p.lat, lon: p.lon })));
  const outers = assembleRings(byRole('outer'));
  const inners = assembleRings(byRole('inner'));
  const id = featureId('relation', e.id);
  return outers.map((outer, i) => ({
    layer: area.layer,
    type: 'polygon' as const,
    coords: [outer, ...inners.filter((inner) => inside(inner[0]!, outer))],
    tags: named(tags, area.cls),
    id: id + i * 4 ** 10,
    minZoom: area.minZoom,
  }));
}

/** The features of an answer, in a stable order. Elements that are not drawn are left out. */
export function parseOverpass(answer: OverpassAnswer): Feature[] {
  const out: Feature[] = [];
  for (const e of answer.elements) {
    if (e.type === 'node') {
      const f = nodeFeature(e);
      if (f) out.push(f);
    } else if (e.type === 'way') {
      const f = wayFeature(e);
      if (f) out.push(f);
    } else if (e.type === 'relation') {
      out.push(...relationFeatures(e));
    }
  }
  return out;
}
