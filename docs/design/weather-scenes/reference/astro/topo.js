// L2/L5: topocentric altitude/azimuth of sun and moon, bright-limb position angle,
// parallactic angle and the resulting crescent tilt. Vector method: observer position in the
// true-equator-of-date frame (WGS-84 ellipsoid, sea level) subtracted from the geocentric body.
import { DEG, sind, cosd, norm360, norm180, jdUT, centuriesTT, nutation, sunApparent, moonApparent, eclToEq, gast } from './core.js';

const RE = 6378.1366; // km, same equatorial radius as astronomy-engine
const F = 1 / 298.25642;

/** Geocentric -> topocentric equatorial (deg, km). lst = local apparent sidereal time (deg). */
function topocentric(ra, dec, distKm, latDeg, lst) {
  const u = Math.atan((1 - F) * Math.tan(latDeg * DEG));
  const rc = RE * Math.cos(u), rs = RE * (1 - F) * Math.sin(u);
  const x = distKm * cosd(dec) * cosd(ra) - rc * cosd(lst);
  const y = distKm * cosd(dec) * sind(ra) - rc * sind(lst);
  const z = distKm * sind(dec) - rs;
  const d = Math.hypot(x, y, z);
  return { ra: norm360(Math.atan2(y, x) / DEG), dec: Math.asin(z / d) / DEG, distKm: d };
}

/** Equatorial -> horizontal (geometric, no refraction). Azimuth from north through east. */
export function toHorizon(ra, dec, latDeg, lst) {
  const H = lst - ra;
  const alt = Math.asin(sind(latDeg) * sind(dec) + cosd(latDeg) * cosd(dec) * cosd(H)) / DEG;
  const az = norm360(Math.atan2(-cosd(dec) * sind(H), sind(dec) * cosd(latDeg) - cosd(dec) * cosd(H) * sind(latDeg)) / DEG);
  return { alt, az, H };
}

/** Atmospheric refraction (deg) for a geometric altitude, same formula astronomy-engine uses ('normal'). */
export function refraction(alt) {
  const h = Math.max(alt, -1);
  return h > 90 ? 0 : (1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG)) / 60;
}

/**
 * Topocentric sun and moon for an observer. moonTerms: 15 (lite) or 60 (full).
 * Returns apparent RA/Dec, distance, geometric altitude/azimuth.
 */
export function sky(ms, latDeg, lonDeg, moonTerms = 60) {
  const jd = jdUT(ms);
  const T = centuriesTT(jd);
  const { eps } = nutation(T);
  const lst = gast(jd, T) + lonDeg;
  const s = sunApparent(T), m = moonApparent(T, moonTerms);
  const se = eclToEq(s.lon, 0, eps), me = eclToEq(m.lon, m.lat, eps);
  const st = topocentric(se.ra, se.dec, s.distKm, latDeg, lst);
  const mt = topocentric(me.ra, me.dec, m.distKm, latDeg, lst);
  return {
    lst,
    sun: { ...st, ...toHorizon(st.ra, st.dec, latDeg, lst) },
    moon: { ...mt, ...toHorizon(mt.ra, mt.dec, latDeg, lst) },
  };
}

/** Position angle (deg, from celestial north through east) of the bright limb, Meeus 48.5. */
export function brightLimbPA(sunEq, moonEq) {
  const da = sunEq.ra - moonEq.ra;
  return norm360(Math.atan2(cosd(sunEq.dec) * sind(da),
    sind(sunEq.dec) * cosd(moonEq.dec) - cosd(sunEq.dec) * sind(moonEq.dec) * cosd(da)) / DEG);
}

/** Parallactic angle q (deg): position angle of the zenith as seen at the body, Meeus 14.1. */
export function parallacticAngle(H, dec, latDeg) {
  return Math.atan2(sind(H), Math.tan(latDeg * DEG) * cosd(dec) - sind(dec) * cosd(H)) / DEG;
}

/**
 * Crescent tilt: direction of the lit limb's midpoint relative to "up" (towards the zenith),
 * in degrees, -180..180. 0 = lit side up, +90 = lit side to the left (east side for an
 * observer facing the moon), -90 = lit side to the right, +-180 = lit side down.
 * Drawing: take an icon whose lit limb points up and rotate it counter-clockwise by `tilt`
 * (CSS: transform: rotate(-tilt deg), because CSS rotates clockwise). Ill-defined within ~1 deg
 * of the zenith (q undefined) and meaningless near new/full moon (use only for 3..97 %).
 */
export function crescentTilt(ms, latDeg, lonDeg, moonTerms = 60) {
  const k = sky(ms, latDeg, lonDeg, moonTerms);
  const chi = brightLimbPA(k.sun, k.moon);
  const q = parallacticAngle(k.moon.H, k.moon.dec, latDeg);
  return { tilt: norm180(chi - q), chi, q, sky: k };
}
