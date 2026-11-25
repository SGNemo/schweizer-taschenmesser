/**
 * Aurora "possible" tonight (CONCEPT-SOURCES §2): the place's geomagnetic latitude from the centred dipole, the Kp it
 * needs, and the NOAA SWPC planetary K index forecast – one global file, no position sent. Verified live on
 * 2026-11-25: an array of objects `{ time_tag, kp, observed: observed|estimated|predicted, noaa_scale }`, 3-hour
 * steps, `time_tag` UTC without a zone; the older layout (first row = keys) is read as well.
 */
import { z } from 'zod';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { cosd, DEG, sind } from './core';
import { sky } from './topo';

export const SWPC_KP_URL =
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

/** Geomagnetic north pole of the centred dipole (CONCEPT-SOURCES §2). */
const POLE_LAT = 80.8;
const POLE_LON = -72.8;

/** Geomagnetic latitude, deg (− south of the magnetic equator). */
export function geomagneticLatitude(lat: number, lon: number): number {
  const s = sind(lat) * sind(POLE_LAT) + cosd(lat) * cosd(POLE_LAT) * cosd(lon - POLE_LON);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

/**
 * The Kp a display needs to be seen low on the horizon: the oval's edge moves about 2° toward the equator per Kp step
 * (rule of thumb of CONCEPT-SOURCES §2). `undefined` when even Kp 9 is not enough: such a place never asks the file.
 */
export function kpNeeded(lat: number, lon: number): number | undefined {
  const raw = Math.ceil((62 - Math.abs(geomagneticLatitude(lat, lon))) / 2);
  if (raw > 9) return undefined;
  return Math.max(0, raw);
}

export interface KpStep {
  /** Start of the 3-hour step, UTC ms. */
  at: number;
  kp: number;
}

const objectLayout = z.array(
  z.object({ time_tag: z.string(), kp: z.number().finite() }).passthrough(),
);
const rowLayout = z.array(z.array(z.union([z.string(), z.number(), z.null()])));
const utc = (tag: string): number =>
  Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(tag) ? tag : `${tag.replace(' ', 'T')}Z`);

/** Both JSON layouts of the SWPC file → steps; `undefined` for anything else. */
export function parseKp(body: unknown): KpStep[] | undefined {
  const o = objectLayout.safeParse(body);
  if (o.success)
    return o.data
      .map((r) => ({ at: utc(r.time_tag), kp: r.kp }))
      .filter((s) => Number.isFinite(s.at));
  const r = rowLayout.safeParse(body);
  if (!r.success || r.data.length < 2) return undefined;
  const head = r.data[0]!.map(String);
  const ti = head.indexOf('time_tag');
  const ki = head.findIndex((h) => h.toLowerCase() === 'kp');
  if (ti < 0 || ki < 0) return undefined;
  return r.data
    .slice(1)
    .map((row) => ({ at: utc(String(row[ti])), kp: Number(row[ki]) }))
    .filter((s) => Number.isFinite(s.at) && Number.isFinite(s.kp));
}

const STEP = 3 * 3600000;
const DARK = -12;

export interface AuroraTonight {
  /** The dark span of the steps that reach the need (UTC ms). */
  from: number;
  to: number;
  /** Highest forecast Kp in that span. */
  kp: number;
  /** Picture strength: 0.4 when Kp just reaches the need, 0.7 at +1, 1 at +2 or more. */
  strength: 0.4 | 0.7 | 1;
}

/**
 * The steps of the coming night (from now until 18 h on) whose Kp reaches the place's need while the sun is lower than
 * −12° in them. Polar day (no dark step) → nothing.
 */
export function auroraTonight(
  steps: readonly KpStep[],
  lat: number,
  lon: number,
  nowMs: number,
): AuroraTonight | undefined {
  const need = kpNeeded(lat, lon);
  if (need === undefined) return undefined;
  const end = nowMs + 18 * 3600000;
  let from: number | undefined;
  let to = 0;
  let kp = 0;
  for (const s of steps) {
    if (s.at + STEP <= nowMs || s.at >= end || s.kp < need) continue;
    // Dark parts of the step, sampled every 30 min.
    for (let t = Math.max(s.at, nowMs); t < s.at + STEP; t += 1800000) {
      if (sky(t, lat, lon, 15).sun.alt >= DARK) continue;
      from = from === undefined ? t : Math.min(from, t);
      to = Math.max(to, Math.min(t + 1800000, s.at + STEP));
      kp = Math.max(kp, s.kp);
    }
  }
  if (from === undefined) return undefined;
  const over = kp - need;
  return { from, to, kp, strength: over >= 2 ? 1 : over >= 1 ? 0.7 : 0.4 };
}

/* --- request and cache (global, kept across place changes) --- */

export const KP_KEY = 'tm-weather-kp';
const KP_TRIED_KEY = 'tm-weather-kp-tried';
const KP_TTL_MS = 3 * 3600000;
const KP_RETRY_MS = 30 * 60000;
const storedSchema = z.object({
  at: z.number().finite(),
  steps: z.array(z.object({ at: z.number().finite(), kp: z.number().finite() })),
});

export function readKp(): KpStep[] | undefined {
  try {
    const raw = localStorage.getItem(KP_KEY);
    if (!raw) return undefined;
    const p = storedSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data.steps : undefined;
  } catch {
    return undefined;
  }
}

const listeners = new Set<() => void>();
export function onKpChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let inflight: Promise<void> | undefined;

/**
 * Asks the SWPC file at most every 3 h, only when the place can see an aurora at all (`kpNeeded` defined) and the
 * switch is on; never offline. The URL carries nothing about the user. Silent on failure.
 */
export function refreshKp(
  lat: number,
  lon: number,
  on: boolean,
  f: typeof fetch = (i, init) => getPlatform().fetch(i, init),
): Promise<void> {
  if (!on || kpNeeded(lat, lon) === undefined) return Promise.resolve();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();
  const t = now();
  try {
    const s = storedSchema.safeParse(JSON.parse(localStorage.getItem(KP_KEY) ?? 'null'));
    if (s.success && t - s.data.at < KP_TTL_MS) return Promise.resolve();
    const tried = Number(localStorage.getItem(KP_TRIED_KEY));
    if (tried && t - tried < KP_RETRY_MS) return Promise.resolve();
  } catch {
    // Storage blocked: ask once.
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await f(SWPC_KP_URL, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const steps = parseKp(await res.json());
      if (!steps) throw new Error('shape');
      localStorage.setItem(KP_KEY, JSON.stringify({ at: now(), steps }));
      listeners.forEach((fn) => fn());
    } catch {
      try {
        localStorage.setItem(KP_TRIED_KEY, String(now()));
      } catch {
        // Nothing to note.
      }
    } finally {
      inflight = undefined;
    }
  })();
  return inflight;
}
