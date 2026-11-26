/**
 * Civil twilight (the sun's centre 6° below the horizon) of a local day: the morning crossing upwards and the
 * evening crossing downwards (CONCEPT-INFO §4; the forecast does not deliver it). Geocentric sun altitude, sampled
 * every 10 minutes and refined by bisection to about a second; enough for a time shown to the minute.
 */
import { centuriesTT, eclToEq, gast, jdUT, nutation, sunApparent } from './core';
import { dayBounds } from './moonDay';
import { toHorizon } from './topo';

/** The sun's altitude below the horizon at which civil twilight begins and ends, deg. */
export const CIVIL_DEG = -6;
const STEP_MS = 10 * 60 * 1000;

/** Geometric altitude of the sun's centre, deg. */
export function sunAltitude(ms: number, lat: number, lon: number): number {
  const jd = jdUT(ms);
  const T = centuriesTT(jd);
  const { eps } = nutation(T);
  const s = sunApparent(T);
  const eq = eclToEq(s.lon, 0, eps);
  return toHorizon(eq.ra, eq.dec, lat, gast(jd, T) + lon).alt;
}

function refine(a: number, b: number, f: (ms: number) => number): number {
  let fa = f(a);
  while (b - a > 1000) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa < 0 === fm < 0) {
      a = m;
      fa = fm;
    } else b = m;
  }
  return (a + b) / 2;
}

/**
 * Start and end of civil twilight on `date` in the zone (ms): the first rise of the sun through −6° and the last
 * fall through it. `null` where it does not happen that day (polar day or night, or it stays light all night).
 */
export function civilTwilight(
  date: string,
  lat: number,
  lon: number,
  tz?: string,
): { dawn: number | null; dusk: number | null } {
  const { start, end } = dayBounds(date, tz);
  const f = (ms: number) => sunAltitude(ms, lat, lon) - CIVIL_DEG;
  let dawn: number | null = null;
  let dusk: number | null = null;
  let t0 = start;
  let f0 = f(t0);
  while (t0 < end) {
    const t1 = Math.min(t0 + STEP_MS, end);
    const f1 = f(t1);
    if (f0 < 0 && f1 >= 0 && dawn === null) dawn = refine(t0, t1, f);
    if (f0 >= 0 && f1 < 0) dusk = refine(t0, t1, f);
    t0 = t1;
    f0 = f1;
  }
  return { dawn, dusk };
}
