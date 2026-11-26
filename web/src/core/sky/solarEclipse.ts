/**
 * Local solar eclipses by numerical search, ported from docs/design/weather-scenes@ca90c392f/reference/astro/solarEclipse.js
 * (CONCEPT-EVENTS §1): candidates are the new moons with |moon latitude| < 1.6°, contacts where the topocentric
 * separation equals the sum of the semi-diameters. No table, no network.
 */
import { centuriesTT, DEG, jdUT, moonApparent } from './core';
import { phasesBetween } from './phases';
import { refraction, sky } from './topo';

const SUN_R = 695700;
const MOON_R = 1737.4;
const MOON_R_POLAR = 1736.0; // km, as astronomy-engine

function geom(ms: number, lat: number, lon: number) {
  const k = sky(ms, lat, lon, 60);
  const s = k.sun;
  const m = k.moon;
  const c =
    Math.sin(s.dec * DEG) * Math.sin(m.dec * DEG) +
    Math.cos(s.dec * DEG) * Math.cos(m.dec * DEG) * Math.cos((s.ra - m.ra) * DEG);
  const sep = Math.acos(Math.min(1, c));
  return {
    sep,
    rs: Math.asin(SUN_R / s.distKm),
    rm: Math.asin(MOON_R / m.distKm),
    rmPolar: Math.asin(MOON_R_POLAR / m.distKm),
    /** Apparent altitude of the sun's centre (with refraction), deg. */
    sunAlt: s.alt + refraction(s.alt),
  };
}

/** Fraction of disc a covered by disc b at centre distance c (as astronomy-engine). */
export function overlap(a: number, b: number, c: number): number {
  if (c >= a + b) return 0;
  if (c <= Math.abs(a - b)) return a <= b ? 1 : (b * b) / (a * a);
  const x = (a * a - b * b + c * c) / (2 * c);
  const y = Math.sqrt(a * a - x * x);
  return (
    (a * a * Math.acos(x / a) - x * y + b * b * Math.acos((c - x) / b) - (c - x) * y) /
    (Math.PI * a * a)
  );
}

/** Root of fn between a and b (opposite signs), to half a second. */
function bisect(fn: (t: number) => number, a: number, b: number): number {
  let fa = fn(a);
  for (let i = 0; i < 40 && Math.abs(b - a) > 500; i++) {
    const c = (a + b) / 2;
    const fc = fn(c);
    if (fc * fa > 0) {
      a = c;
      fa = fc;
    } else b = c;
  }
  return (a + b) / 2;
}

export type SolarKind = 'partial' | 'total' | 'annular';

export interface LocalSolarEclipse {
  kind: SolarKind;
  /** Fraction of the sun's disc covered at the local maximum (1 for total). */
  obscuration: number;
  begin: number;
  peak: number;
  end: number;
  /** Apparent altitude of the sun at begin, peak and end, deg. */
  altBegin: number;
  altPeak: number;
  altEnd: number;
  /** The largest coverage while the sun is above the horizon (CONCEPT-EVENTS §1). */
  visibleObscuration: number;
  /** When the sun sets (rises) during the eclipse: that instant, else undefined. */
  sunSet?: number;
  sunRise?: number;
}

/** Coverage of the sun's disc at an instant, 0…1 (1 = total). */
export function obscurationAt(ms: number, lat: number, lon: number): number {
  const g = geom(ms, lat, lon);
  if (g.sep < g.rm - g.rs) return 1;
  return Math.min(1, overlap(g.rs, g.rmPolar, g.sep));
}

/** True while the moon's disc lies wholly inside the sun's (the ring) or covers it (totality). */
export function centralAt(ms: number, lat: number, lon: number): boolean {
  const g = geom(ms, lat, lon);
  return g.sep < Math.abs(g.rm - g.rs);
}

/** Local circumstances near a new moon instant, or null if there is no eclipse at this place. */
export function localSolarEclipse(
  newMoonMs: number,
  lat: number,
  lon: number,
): LocalSolarEclipse | null {
  const W = 0.3 * 86400000;
  const STEP = 600000;
  const g = (t: number) => geom(t, lat, lon).sep;
  let best = newMoonMs - W;
  let bestSep = Infinity;
  for (let t = newMoonMs - W; t <= newMoonMs + W; t += STEP) {
    const s = g(t);
    if (s < bestSep) {
      bestSep = s;
      best = t;
    }
  }
  let a = best - STEP;
  let b = best + STEP; // golden-section refine of the minimum
  for (let i = 0; i < 30; i++) {
    const m1 = a + (b - a) * 0.382;
    const m2 = a + (b - a) * 0.618;
    if (g(m1) < g(m2)) b = m2;
    else a = m1;
  }
  const peak = (a + b) / 2;
  const P = geom(peak, lat, lon);
  if (P.sep >= P.rs + P.rm) return null;
  const outer = (t: number) => {
    const x = geom(t, lat, lon);
    return x.sep - (x.rs + x.rm);
  };
  const begin = bisect(outer, peak - W, peak);
  const end = bisect(outer, peak + W, peak);
  const central = P.sep < Math.abs(P.rm - P.rs);
  const kind: SolarKind = central ? (P.rm > P.rs ? 'total' : 'annular') : 'partial';
  const obscuration = kind === 'total' ? 1 : Math.min(0.9999, overlap(P.rs, P.rmPolar, P.sep));
  const alt = (t: number) => geom(t, lat, lon).sunAlt;
  const altBegin = alt(begin);
  const altEnd = alt(end);
  // The largest coverage while the sun is up: the maximum itself when the sun is up then; otherwise the
  // coverage rises towards the peak and falls after it, so its largest visible value is at sunset / sunrise.
  let visibleObscuration = 0;
  let sunSet: number | undefined;
  let sunRise: number | undefined;
  if (altBegin > 0 && alt(peak) <= 0) sunSet = bisect(alt, begin, peak);
  else if (altBegin > 0 && altEnd <= 0) sunSet = bisect(alt, peak, end);
  if (altEnd > 0 && alt(peak) <= 0) sunRise = bisect(alt, peak, end);
  else if (altEnd > 0 && altBegin <= 0) sunRise = bisect(alt, begin, peak);
  if (P.sunAlt > 0) visibleObscuration = obscuration;
  else {
    if (sunSet !== undefined) visibleObscuration = obscurationAt(sunSet, lat, lon);
    if (sunRise !== undefined)
      visibleObscuration = Math.max(visibleObscuration, obscurationAt(sunRise, lat, lon));
  }
  return {
    kind,
    obscuration,
    begin,
    peak,
    end,
    altBegin,
    altPeak: P.sunAlt,
    altEnd,
    visibleObscuration,
    ...(sunSet !== undefined && { sunSet }),
    ...(sunRise !== undefined && { sunRise }),
  };
}

/** All local solar eclipses with a new moon in [fromMs, toMs) and the sun up at begin or end. */
export function localSolarEclipses(
  fromMs: number,
  toMs: number,
  lat: number,
  lon: number,
): LocalSolarEclipse[] {
  const out: LocalSolarEclipse[] = [];
  for (const p of phasesBetween(fromMs, toMs)) {
    if (p.phase !== 0) continue;
    if (Math.abs(moonApparent(centuriesTT(jdUT(p.ms)), 60).lat) > 1.6) continue;
    const e = localSolarEclipse(p.ms, lat, lon);
    if (e && (e.altBegin > 0 || e.altEnd > 0)) out.push(e);
  }
  return out;
}

/** A solar eclipse is shown when at least 5 % of the sun is covered while it is up (CONCEPT-EVENTS §1). */
export const SOLAR_MIN = 0.05;
