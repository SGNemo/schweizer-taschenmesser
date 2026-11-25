/**
 * Official DWD warnings for the main place in Germany (CONCEPT-SOURCES §3, verified against the live GeoServer on
 * 2026-11-25): WFS `GetFeature` on `dwd:Warnungen_Gemeinden`, JSON, filtered to the place's rounded point, only the
 * fields used. Level 2 and up (Moderate, Severe, Extreme), no advance information, no UV; the event in ordinary case.
 * Cached under its own key; shown only while the last good answer is under 60 minutes old.
 */
import { z } from 'zod';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { inGermany } from './germany';
import { localDate as localDateOf } from '@/core/sky/moonDay';

export const DWD_URL = 'https://maps.dwd.de/geoserver/dwd/ows';
/** The general DWD warnings page the pill's source link opens (it carries no place). */
export const DWD_WARNINGS_PAGE = 'https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html';

/** The hint kinds of `modules/weather/warnings.ts` (core does not import modules). */
export type OfficialKind = 'storm' | 'wind' | 'ice' | 'rain' | 'heat' | 'frost';

export interface OfficialWarning {
  /** The event as issued, in ordinary case ("Orkanartige Böen"). */
  event: string;
  /** DWD level 2 (markantes Wetter) … 4 (extremes Unwetter). */
  level: 2 | 3 | 4;
  kind?: OfficialKind;
  onset: number;
  expires: number;
}

const LEVEL: Record<string, 2 | 3 | 4 | undefined> = { Moderate: 2, Severe: 3, Extreme: 4 };

const featureSchema = z.object({
  properties: z.object({
    EVENT: z.string(),
    SEVERITY: z.string(),
    URGENCY: z.string().nullish(),
    ONSET: z.string().nullish(),
    EXPIRES: z.string().nullish(),
    EC_GROUP: z.string().nullish(),
    STATUS: z.string().nullish(),
    MSGTYPE: z.string().nullish(),
  }),
});
const answerSchema = z.object({ features: z.array(z.unknown()) });

/** "ORKANARTIGE BÖEN" → "Orkanartige Böen" (nothing else is reworded). */
export function displayEvent(raw: string): string {
  return raw
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w) => (w.trim() && w !== '-' ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join('');
}

/** The hint kind of a DWD event (CONCEPT-SOURCES §3); snow, fog, thaw and the rest have none. */
export function kindOf(event: string, group = ''): OfficialKind | undefined {
  const g = group.toUpperCase();
  const e = event.toUpperCase();
  if (g.includes('THUNDERSTORM') || e.includes('GEWITTER')) return 'storm';
  if (g.includes('GLAZE') || /GLATTEIS|GLÄTTE|GEFRIERENDER/.test(e)) return 'ice';
  if (g.includes('WIND') || /BÖEN|STURM|ORKAN/.test(e)) return 'wind';
  if (g.includes('RAIN') || /REGEN/.test(e)) return 'rain';
  if (g.includes('HEAT') || e.includes('HITZE')) return 'heat';
  if (g.includes('FROST') || e.includes('FROST')) return 'frost';
  return undefined;
}

/** Reads a GeoServer answer; level 1, advance information, UV, tests and cancellations are dropped here. */
export function parseOfficial(body: unknown): OfficialWarning[] | undefined {
  const a = answerSchema.safeParse(body);
  if (!a.success) return undefined;
  const out: OfficialWarning[] = [];
  for (const f of a.data.features) {
    const p = featureSchema.safeParse(f);
    if (!p.success) continue;
    const x = p.data.properties;
    const level = LEVEL[x.SEVERITY];
    if (!level) continue;
    if (x.URGENCY === 'Future') continue;
    if ((x.STATUS ?? 'Actual') !== 'Actual' || x.MSGTYPE === 'Cancel') continue;
    if ((x.EC_GROUP ?? '').toUpperCase().includes('UV') || /\bUV\b/i.test(x.EVENT)) continue;
    const onset = Date.parse(x.ONSET ?? '');
    const expires = Date.parse(x.EXPIRES ?? '');
    if (!Number.isFinite(onset) || !Number.isFinite(expires)) continue;
    const kind = kindOf(x.EVENT, x.EC_GROUP ?? '');
    out.push({ event: displayEvent(x.EVENT), level, ...(kind && { kind }), onset, expires });
  }
  // Several warnings of one event: the one that ends last.
  const byEvent = new Map<string, OfficialWarning>();
  for (const w of out) {
    const had = byEvent.get(w.event);
    if (!had || w.expires > had.expires) byEvent.set(w.event, w);
  }
  return [...byEvent.values()];
}

/** In force now or beginning later today (the place's local day), highest level first, then the earliest end. */
export function activeOfficial(
  warnings: readonly OfficialWarning[],
  nowMs: number,
  tz?: string,
): OfficialWarning[] {
  const today = localDateOf(nowMs, tz);
  return warnings
    .filter((w) => w.expires > nowMs && (w.onset <= nowMs || localDateOf(w.onset, tz) === today))
    .sort((a, b) => b.level - a.level || a.expires - b.expires);
}

/** Today's computed hints of a kind an official warning has are dropped; other kinds and later days stay. */
export function withoutReplaced<T extends { kind: string; date: string }>(
  computed: readonly T[],
  official: readonly OfficialWarning[] | undefined,
  today: string,
): T[] {
  if (!official?.length) return [...computed];
  const kinds = new Set(official.map((w) => w.kind).filter(Boolean));
  return computed.filter((w) => !(w.date === today && kinds.has(w.kind as OfficialKind)));
}

/* --- request and cache (own keys, CONCEPT-SOURCES §1, handoff/03b "cache") --- */

export const OFFICIAL_KEY = 'tm-weather-official';
export const OFFICIAL_TRIED_KEY = 'tm-weather-official-tried';
const TTL_MS = 30 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
/** Older than this, the warnings are not shown at all (better none than an outdated one). */
export const OFFICIAL_MAX_AGE_MS = 60 * 60 * 1000;

const storedSchema = z.object({
  key: z.string(),
  at: z.number().finite(),
  warnings: z.array(
    z.object({
      event: z.string(),
      level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      kind: z.enum(['storm', 'wind', 'ice', 'rain', 'heat', 'frost']).optional(),
      onset: z.number().finite(),
      expires: z.number().finite(),
    }),
  ),
});
type Stored = z.infer<typeof storedSchema>;

function read<T>(key: string, schema: z.ZodType<T>): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const p = schema.safeParse(JSON.parse(raw));
    if (p.success) return p.data;
    localStorage.removeItem(key);
  } catch {
    // Damaged or blocked: reads as absent.
  }
  return undefined;
}
function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: asked again next time.
  }
}

const placeKey = (lat: number, lon: number) => `${lat},${lon}`;
const listeners = new Set<() => void>();
/** Re-render hooks when a new answer is stored. */
export function onOfficialChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The official warnings of the main place as last fetched, or `undefined` when there is no usable answer (other
 * place, never asked, older than 60 minutes): the computed hints then stay as they are.
 */
export function readOfficial(
  lat: number,
  lon: number,
  nowMs = now(),
): OfficialWarning[] | undefined {
  const s = read<Stored>(OFFICIAL_KEY, storedSchema);
  if (!s || s.key !== placeKey(lat, lon) || nowMs - s.at > OFFICIAL_MAX_AGE_MS) return undefined;
  return s.warnings;
}

export function clearOfficial(): void {
  try {
    localStorage.removeItem(OFFICIAL_KEY);
    localStorage.removeItem(OFFICIAL_TRIED_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The request URL: only the rounded position of the main place, only the fields used. */
export function officialUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: 'dwd:Warnungen_Gemeinden',
    outputFormat: 'application/json',
    propertyName: 'EVENT,SEVERITY,URGENCY,ONSET,EXPIRES,EC_GROUP,STATUS,MSGTYPE',
    CQL_FILTER: `INTERSECTS(THE_GEOM,POINT(${lat} ${lon}))`,
  });
  return `${DWD_URL}?${q}`;
}

let inflight: Promise<void> | undefined;

/**
 * Asks the DWD for the main place when it is in Germany, the switch is on, the device is online and the last answer
 * or failure is old enough. Silent on every failure. `lat`/`lon` are the stored, already rounded position.
 */
export function refreshOfficial(
  lat: number,
  lon: number,
  on: boolean,
  f: typeof fetch = (i, init) => getPlatform().fetch(i, init),
): Promise<void> {
  if (!on || !inGermany(lat, lon)) return Promise.resolve();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();
  const key = placeKey(lat, lon);
  const t = now();
  const s = read<Stored>(OFFICIAL_KEY, storedSchema);
  if (s?.key === key && t - s.at < TTL_MS) return Promise.resolve();
  const tried = read(OFFICIAL_TRIED_KEY, z.object({ key: z.string(), at: z.number() }));
  if (tried?.key === key && t - tried.at < RETRY_MS) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await f(officialUrl(lat, lon), { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const warnings = parseOfficial(await res.json());
      if (!warnings) throw new Error('shape');
      write(OFFICIAL_KEY, { key, at: now(), warnings } satisfies Stored);
      listeners.forEach((fn) => fn());
    } catch {
      write(OFFICIAL_TRIED_KEY, { key, at: now() });
    } finally {
      inflight = undefined;
    }
  })();
  return inflight;
}
