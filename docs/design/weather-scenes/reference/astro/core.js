// Low-precision sun and moon positions (Meeus, "Astronomical Algorithms", 2nd ed.).
// L1 core: time scales, nutation, sun (ch. 25 low accuracy), moon (ch. 47, truncatable).
// All angles in degrees unless a name ends in "Rad". Input time = JS ms since epoch (UTC).

export const DEG = Math.PI / 180;
export const sind = (x) => Math.sin(x * DEG);
export const cosd = (x) => Math.cos(x * DEG);
export const norm360 = (x) => ((x % 360) + 360) % 360;
export const norm180 = (x) => { const y = norm360(x); return y > 180 ? y - 360 : y; };

/** Julian Day (UT) from JS milliseconds. */
export const jdUT = (ms) => ms / 86400000 + 2440587.5;
export const msFromJdUT = (jd) => (jd - 2440587.5) * 86400000;

/** Delta T in seconds. Espenak–Meeus polynomial for 2005–2050 (same model astronomy-engine uses). */
export function deltaT(jd) {
  const y = 2000 + (jd - 2451545 - 14) / 365.24217;
  const t = y - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

/** Julian centuries TT since J2000 for a UT JD. */
export const centuriesTT = (jd) => (jd + deltaT(jd) / 86400 - 2451545) / 36525;

/** Nutation in longitude/obliquity (Meeus ch. 22, 0.5" version) and true obliquity. */
export function nutation(T) {
  const om = 125.04452 - 1934.136261 * T;
  const L = 280.4665 + 36000.7698 * T; // sun mean longitude
  const Lm = 218.3165 + 481267.8813 * T; // moon mean longitude
  const dpsi = (-17.2 * sind(om) - 1.32 * sind(2 * L) - 0.23 * sind(2 * Lm) + 0.21 * sind(2 * om)) / 3600;
  const deps = (9.2 * cosd(om) + 0.57 * cosd(2 * L) + 0.1 * cosd(2 * Lm) - 0.09 * cosd(2 * om)) / 3600;
  const eps0 = 23.4392911 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
  return { dpsi, eps: eps0 + deps };
}

/** Apparent geocentric sun: ecliptic longitude (deg, of date), distance (km). Accuracy ~0.01 deg. */
export function sunApparent(T) {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M)
    + (0.019993 - 0.000101 * T) * sind(2 * M) + 0.000289 * sind(3 * M);
  const v = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cosd(v)); // AU
  const { dpsi } = nutation(T);
  // aberration -20.4898"/R, nutation added
  const lon = norm360(L0 + C + dpsi - 0.005691611 / R);
  return { lon, lat: 0, distKm: R * 149597870.7 };
}

// Meeus table 47.A: [D, M, M', F, sum_l (1e-6 deg), sum_r (1e-3 km)] ordered by |sum_l| roughly.
const T47A = [
  [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],
  [0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],
  [2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
  [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],
  [4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],
  [2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
  [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],
  [2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],
  [0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
  [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],
  [2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],
  [2,1,-2,0,691,0],[2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
  [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],[0,0,2,-2,-381,-4421],
  [1,1,1,0,351,0],[3,0,-2,0,-340,0],[4,0,-3,0,330,0],[2,-1,2,0,327,0],
  [0,2,1,0,-323,1165],[1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752],
];
// Meeus table 47.B: [D, M, M', F, sum_b (1e-6 deg)].
const T47B = [
  [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],
  [2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],
  [2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],
  [2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
  [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],
  [0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833],
  [0,0,1,-3,777],[4,0,-2,1,671],[2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],
  [2,0,-2,1,-451],[0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],
  [2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],[0,0,1,3,-283],
  [2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],[0,1,-2,-1,-220],[2,1,-1,-1,-220],
  [1,0,1,1,-185],[2,-1,-2,-1,181],[0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],
  [1,0,1,-1,-164],[4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107],
];

/**
 * Apparent geocentric moon (ecliptic of date). `terms` = number of rows used from each table
 * (15 = "lite" for phase/illumination; 60 = full Meeus ch. 47 for eclipses/rise-set).
 */
export function moonApparent(T, terms = 60) {
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.29 * T, A3 = 313.45 + 481266.484 * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  let sl = 0, sr = 0, sb = 0;
  const nA = Math.min(terms, T47A.length), nB = Math.min(terms, T47B.length);
  for (let i = 0; i < nA; i++) {
    const [d, m, mp, f, l, r] = T47A[i];
    const arg = d * D + m * M + mp * Mp + f * F;
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sl += l * e * sind(arg);
    sr += r * e * cosd(arg);
  }
  for (let i = 0; i < nB; i++) {
    const [d, m, mp, f, b] = T47B[i];
    const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
    sb += b * e * sind(d * D + m * M + mp * Mp + f * F);
  }
  sl += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sb += -2235 * sind(Lp) + 382 * sind(A3) + 175 * sind(A1 - F) + 175 * sind(A1 + F)
    + 127 * sind(Lp - Mp) - 115 * sind(Lp + Mp);
  const { dpsi } = nutation(T);
  return { lon: norm360(Lp + sl / 1e6 + dpsi), lat: sb / 1e6, distKm: 385000.56 + sr / 1000 };
}

/** Ecliptic (of date) -> equatorial RA/Dec (deg). */
export function eclToEq(lon, lat, eps) {
  const ra = Math.atan2(sind(lon) * cosd(eps) - Math.tan(lat * DEG) * sind(eps), cosd(lon)) / DEG;
  const dec = Math.asin(sind(lat) * cosd(eps) + cosd(lat) * sind(eps) * sind(lon)) / DEG;
  return { ra: norm360(ra), dec };
}

/** Greenwich apparent sidereal time (deg), Meeus 12.4 + equation of the equinoxes. */
export function gast(jd, T) {
  const t = (jd - 2451545) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - (t * t * t) / 38710000;
  const { dpsi, eps } = nutation(T);
  return norm360(gmst + dpsi * cosd(eps));
}

/**
 * Moon phase quantities (geocentric), the L1 result.
 * elong: moon minus sun ecliptic longitude 0..360 (0 new, 90 first quarter, 180 full);
 * k: illuminated fraction 0..1; waxing: elong < 180; distKm: earth–moon centre distance.
 */
export function moonPhase(ms, terms = 15) {
  const T = centuriesTT(jdUT(ms));
  const s = sunApparent(T), m = moonApparent(T, terms);
  const cpsi = cosd(m.lat) * cosd(m.lon - s.lon); // cos of true elongation
  const psi = Math.acos(cpsi);
  const i = Math.atan2(s.distKm * Math.sin(psi), m.distKm - s.distKm * cpsi); // phase angle
  return { elong: norm360(m.lon - s.lon), k: (1 + Math.cos(i)) / 2, waxing: norm360(m.lon - s.lon) < 180, distKm: m.distKm, phaseAngle: i / DEG };
}
