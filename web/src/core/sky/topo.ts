/**
 * Topocentric altitude / azimuth of sun and moon, bright-limb position angle, parallactic angle and the crescent's
 * tilt, ported from docs/design/weather-scenes@ca90c392f/reference/astro/topo.js. Vector method: the observer (WGS-84, sea
 * level) subtracted from the geocentric body in the true-equator-of-date frame.
 */
import {
  centuriesTT,
  cosd,
  DEG,
  eclToEq,
  gast,
  jdUT,
  moonApparent,
  norm180,
  norm360,
  nutation,
  sind,
  sunApparent,
} from './core';

const RE = 6378.1366;
const F = 1 / 298.25642;

export interface Body {
  ra: number;
  dec: number;
  distKm: number;
  /** Geometric altitude (no refraction), deg. */
  alt: number;
  /** Azimuth from north through east, deg. */
  az: number;
  /** Hour angle, deg. */
  H: number;
}

function topocentric(ra: number, dec: number, distKm: number, latDeg: number, lst: number) {
  const u = Math.atan((1 - F) * Math.tan(latDeg * DEG));
  const rc = RE * Math.cos(u);
  const rs = RE * (1 - F) * Math.sin(u);
  const x = distKm * cosd(dec) * cosd(ra) - rc * cosd(lst);
  const y = distKm * cosd(dec) * sind(ra) - rc * sind(lst);
  const z = distKm * sind(dec) - rs;
  const d = Math.hypot(x, y, z);
  return { ra: norm360(Math.atan2(y, x) / DEG), dec: Math.asin(z / d) / DEG, distKm: d };
}

/** Equatorial → horizontal (geometric). */
export function toHorizon(ra: number, dec: number, latDeg: number, lst: number) {
  const H = lst - ra;
  const alt = Math.asin(sind(latDeg) * sind(dec) + cosd(latDeg) * cosd(dec) * cosd(H)) / DEG;
  const az = norm360(
    Math.atan2(
      -cosd(dec) * sind(H),
      sind(dec) * cosd(latDeg) - cosd(dec) * cosd(H) * sind(latDeg),
    ) / DEG,
  );
  return { alt, az, H };
}

/** Topocentric sun and moon for an observer. */
export function sky(
  ms: number,
  latDeg: number,
  lonDeg: number,
  moonTerms = 60,
): { lst: number; sun: Body; moon: Body } {
  const jd = jdUT(ms);
  const T = centuriesTT(jd);
  const { eps } = nutation(T);
  const lst = gast(jd, T) + lonDeg;
  const s = sunApparent(T);
  const m = moonApparent(T, moonTerms);
  const se = eclToEq(s.lon, 0, eps);
  const me = eclToEq(m.lon, m.lat, eps);
  const st = topocentric(se.ra, se.dec, s.distKm, latDeg, lst);
  const mt = topocentric(me.ra, me.dec, m.distKm, latDeg, lst);
  return {
    lst,
    sun: { ...st, ...toHorizon(st.ra, st.dec, latDeg, lst) },
    moon: { ...mt, ...toHorizon(mt.ra, mt.dec, latDeg, lst) },
  };
}

/** Position angle of the bright limb (deg, from celestial north through east), Meeus 48.5. */
export function brightLimbPA(
  sunEq: { ra: number; dec: number },
  moonEq: { ra: number; dec: number },
): number {
  const da = sunEq.ra - moonEq.ra;
  return norm360(
    Math.atan2(
      cosd(sunEq.dec) * sind(da),
      sind(sunEq.dec) * cosd(moonEq.dec) - cosd(sunEq.dec) * sind(moonEq.dec) * cosd(da),
    ) / DEG,
  );
}

/** Parallactic angle q (deg), Meeus 14.1. */
export function parallacticAngle(H: number, dec: number, latDeg: number): number {
  return Math.atan2(sind(H), Math.tan(latDeg * DEG) * cosd(dec) - sind(dec) * cosd(H)) / DEG;
}

/**
 * The crescent's tilt: direction of the lit limb's midpoint against "up" (towards the zenith), −180…180; + = lit side to
 * the left (counter-clockwise from up). Draw an upright-lit shape rotated counter-clockwise by `tilt` (SVG/CSS:
 * `rotate(-tilt)`). Meaningful only for 3–97 % lit and away from the zenith.
 */
export function crescentTilt(ms: number, latDeg: number, lonDeg: number, moonTerms = 60) {
  const k = sky(ms, latDeg, lonDeg, moonTerms);
  const chi = brightLimbPA(k.sun, k.moon);
  const q = parallacticAngle(k.moon.H, k.moon.dec, latDeg);
  return { tilt: norm180(chi - q), chi, q, sky: k };
}

/** Atmospheric refraction (deg) for a geometric altitude, the formula astronomy-engine uses ('normal'). */
export function refraction(alt: number): number {
  const h = Math.max(alt, -1);
  return h > 90 ? 0 : 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG) / 60;
}
