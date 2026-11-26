/**
 * Moonrise and moonset in a [start, end) window (normally one local day), ported from
 * docs/design/weather-scenes@ca90c392f/reference/astro/riseset.js: the moon's upper limb on the apparent horizon (34' refraction
 * + semi-diameter); sampled every 10 minutes (1 h misses grazing events in the far north), refined to about a second.
 */
import { DEG } from './core';
import { sky } from './topo';

const MOON_R = 1738.1;
const REFR = 34 / 60;
/** An upper bound of how fast the moon's altitude changes, deg per minute (0.25 plus a margin). */
const MAX_RATE_DEG_PER_MIN = 0.3;

function f(ms: number, lat: number, lon: number, terms: number): number {
  const m = sky(ms, lat, lon, terms).moon;
  return m.alt + REFR + Math.asin(MOON_R / m.distKm) / DEG;
}

function refine(
  a0: number,
  fa0: number,
  b0: number,
  fb0: number,
  lat: number,
  lon: number,
  terms: number,
): number {
  let a = a0;
  let fa = fa0;
  let b = b0;
  let fb = fb0;
  let side = 0;
  for (let i = 0; i < 30 && b - a > 1000; i++) {
    const c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c, lat, lon, terms);
    if (fc * fb > 0) {
      b = c;
      fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c;
      fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
  }
  return (a + b) / 2;
}

/** The first rise and the first set inside the window (ms), or null. */
export function moonRiseSet(
  startMs: number,
  endMs: number,
  lat: number,
  lon: number,
  terms = 60,
  stepMs = 600000,
  /** Off: the plain 10-minute grid of the reference (the test compares both). */
  adaptive = true,
): { rise: number | null; set: number | null } {
  let rise: number | null = null;
  let set: number | null = null;
  let t0 = startMs;
  let f0 = f(t0, lat, lon, terms);
  while (t0 < endMs && (rise === null || set === null)) {
    // Far from the horizon the moon cannot reach it soon: its altitude changes by at most about 0.25° a minute
    // (the Earth's turn; the moon's own motion is far slower), so a jump of |f| / MAX_RATE minutes cannot step over a
    // crossing. Near the horizon the 10-minute grid stays, so no grazing event is missed (CONCEPT-MOON §1).
    const jump = adaptive ? (Math.abs(f0) / MAX_RATE_DEG_PER_MIN) * 60000 : 0;
    const t1 = Math.min(t0 + Math.max(stepMs, jump), endMs);
    const f1 = f(t1, lat, lon, terms);
    if (f0 < 0 && f1 >= 0 && rise === null) rise = refine(t0, f0, t1, f1, lat, lon, terms);
    if (f0 >= 0 && f1 < 0 && set === null) set = refine(t0, f0, t1, f1, lat, lon, terms);
    t0 = t1;
    f0 = f1;
  }
  return { rise, set };
}
