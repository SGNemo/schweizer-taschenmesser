// L3: moonrise / moonset in a [startMs, endMs) window (normally one local calendar day).
// Criterion: topocentric altitude of the moon's centre = -(34' refraction + semi-diameter),
// i.e. upper limb on the apparent horizon (about +0.125 deg geocentric, Meeus h0 = 0.7275*pi - 34').
// Method: sample every 10 min (1 h misses grazing events above ~60 deg latitude), bracket each sign change, refine by regula falsi (Illinois) to ~1 s.
import { DEG } from './core.js';
import { sky } from './topo.js';

const MOON_R = 1738.1; // km (equatorial, as astronomy-engine)
const REFR = 34 / 60;

function f(ms, lat, lon, terms) {
  const m = sky(ms, lat, lon, terms).moon;
  return m.alt + REFR + Math.asin(MOON_R / m.distKm) / DEG;
}

function refine(a, fa, b, fb, lat, lon, terms) {
  let side = 0;
  for (let i = 0; i < 30 && b - a > 1000; i++) {
    const c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c, lat, lon, terms);
    if (fc * fb > 0) { b = c; fb = fc; if (side === -1) fa /= 2; side = -1; }
    else { a = c; fa = fc; if (side === 1) fb /= 2; side = 1; }
  }
  return (a + b) / 2;
}

/** Returns { rise: ms|null, set: ms|null } = first rise and first set inside the window. */
export function moonRiseSet(startMs, endMs, lat, lon, terms = 60, stepMs = 600000) {
  let rise = null, set = null;
  let t0 = startMs, f0 = f(t0, lat, lon, terms);
  while (t0 < endMs && (rise === null || set === null)) {
    const t1 = Math.min(t0 + stepMs, endMs), f1 = f(t1, lat, lon, terms);
    if (f0 < 0 && f1 >= 0 && rise === null) rise = refine(t0, f0, t1, f1, lat, lon, terms);
    if (f0 >= 0 && f1 < 0 && set === null) set = refine(t0, f0, t1, f1, lat, lon, terms);
    t0 = t1; f0 = f1;
  }
  return { rise, set };
}
