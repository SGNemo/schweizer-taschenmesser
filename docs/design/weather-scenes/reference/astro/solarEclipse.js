// Option (B): local solar eclipse circumstances by numerical search with the low-precision
// positions (full Meeus ch. 47 moon). No shipped table needed: candidates are new moons (L4)
// with |moon latitude| < 1.6 deg. Contacts = topocentric separation equals sum of semi-diameters.
import { DEG, jdUT, centuriesTT, moonApparent } from './core.js';
import { sky, refraction } from './topo.js';
import { phasesBetween } from './phases.js';

const SUN_R = 695700, MOON_R = 1737.4, MOON_R_POLAR = 1736.0; // km, as astronomy-engine

function geom(ms, lat, lon) {
  const k = sky(ms, lat, lon, 60);
  const s = k.sun, m = k.moon;
  const c = Math.sin(s.dec * DEG) * Math.sin(m.dec * DEG) + Math.cos(s.dec * DEG) * Math.cos(m.dec * DEG) * Math.cos((s.ra - m.ra) * DEG);
  const sep = Math.acos(Math.min(1, c));
  const rs = Math.asin(SUN_R / s.distKm), rm = Math.asin(MOON_R / m.distKm);
  return { sep, rs, rm, rmPolar: Math.asin(MOON_R_POLAR / m.distKm), sunAlt: s.alt + refraction(s.alt) };
}

/** Fraction of disc a covered by disc b at centre distance c (same as astronomy-engine). */
export function overlap(a, b, c) {
  if (c >= a + b) return 0;
  if (c <= Math.abs(a - b)) return a <= b ? 1 : (b * b) / (a * a);
  const x = (a * a - b * b + c * c) / (2 * c), y = Math.sqrt(a * a - x * x);
  return (a * a * Math.acos(x / a) - x * y + b * b * Math.acos((c - x) / b) - (c - x) * y) / (Math.PI * a * a);
}

function bisect(fn, a, b) { // fn(a) and fn(b) have opposite signs
  let fa = fn(a);
  for (let i = 0; i < 40 && Math.abs(b - a) > 500; i++) {
    const c = (a + b) / 2, fc = fn(c);
    if (fc * fa > 0) { a = c; fa = fc; } else b = c;
  }
  return (a + b) / 2;
}

/** Local circumstances near a new moon instant, or null if no eclipse at this place. */
export function localSolarEclipse(newMoonMs, lat, lon) {
  const W = 0.3 * 86400000, STEP = 600000;
  const g = (t) => geom(t, lat, lon).sep;
  let best = newMoonMs - W, bestSep = Infinity;
  for (let t = newMoonMs - W; t <= newMoonMs + W; t += STEP) { const s = g(t); if (s < bestSep) { bestSep = s; best = t; } }
  let a = best - STEP, b = best + STEP; // golden-section refine of the minimum
  for (let i = 0; i < 30; i++) { const m1 = a + (b - a) * 0.382, m2 = a + (b - a) * 0.618; if (g(m1) < g(m2)) b = m2; else a = m1; }
  const peak = (a + b) / 2, P = geom(peak, lat, lon);
  if (P.sep >= P.rs + P.rm) return null;
  const outer = (t) => { const x = geom(t, lat, lon); return x.sep - (x.rs + x.rm); };
  const begin = bisect(outer, peak - W, peak), end = bisect(outer, peak + W, peak);
  const central = P.sep < Math.abs(P.rm - P.rs);
  const kind = central ? (P.rm > P.rs ? 'total' : 'annular') : 'partial';
  const obscuration = kind === 'total' ? 1 : Math.min(0.9999, overlap(P.rs, P.rmPolar, P.sep));
  const alt = (t) => geom(t, lat, lon).sunAlt;
  return { kind, obscuration, begin, peak, end, altBegin: alt(begin), altPeak: P.sunAlt, altEnd: alt(end) };
}

/** All local solar eclipses in [fromMs, toMs) with the sun up at begin or end (astronomy-engine's filter). */
export function localSolarEclipses(fromMs, toMs, lat, lon) {
  const out = [];
  for (const p of phasesBetween(fromMs, toMs)) {
    if (p.phase !== 0) continue;
    if (Math.abs(moonApparent(centuriesTT(jdUT(p.ms)), 60).lat) > 1.6) continue;
    const e = localSolarEclipse(p.ms, lat, lon);
    if (e && (e.altBegin > 0 || e.altEnd > 0)) out.push(e);
  }
  return out;
}
