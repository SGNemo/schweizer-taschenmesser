/**
 * Meteor nights (CONCEPT-EVENTS §1): six showers, values checked against the IMO Meteor Shower Calendar 2026
 * (λ☉ J2000 of the peak, radiant RA / Dec, ZHR). The peak instant is found from the sun's longitude; a shower
 * shows on the night nearest its peak when its radiant reaches 25° while the sun is lower than −12°.
 */
import { centuriesTT, gast, jdUT, norm180, nutation, sunApparent } from './core';
import { dayBounds, localDate } from './moonDay';
import { sky, toHorizon } from './topo';

export type ShowerId = 'QUA' | 'LYR' | 'ETA' | 'PER' | 'ORI' | 'GEM';

export interface Shower {
  id: ShowerId;
  /** Sun's longitude at the peak, J2000, deg. */
  lambda: number;
  /** Radiant at the peak, deg. */
  ra: number;
  dec: number;
  zhr: number;
  /** When the radiant stands best. */
  best: 'midnight' | 'evening';
}

export const SHOWERS: readonly Shower[] = [
  { id: 'QUA', lambda: 283.15, ra: 230, dec: 49, zhr: 80, best: 'midnight' },
  { id: 'LYR', lambda: 32.32, ra: 271, dec: 34, zhr: 18, best: 'midnight' },
  { id: 'ETA', lambda: 45.5, ra: 338, dec: -1, zhr: 50, best: 'midnight' },
  { id: 'PER', lambda: 140.0, ra: 48, dec: 58, zhr: 100, best: 'midnight' },
  { id: 'ORI', lambda: 208.0, ra: 95, dec: 16, zhr: 20, best: 'midnight' },
  { id: 'GEM', lambda: 262.2, ra: 112, dec: 33, zhr: 150, best: 'evening' },
];

const DAY = 86400000;
/** Radiant at least this high, deg, while the sun is lower than SUN_MAX. */
export const RADIANT_MIN = 25;
const SUN_MAX = -12;
const STEP = 10 * 60000;

/** Sun's longitude referred to the mean equinox J2000 (apparent of date minus nutation and precession), deg. */
function lambdaJ2000(ms: number): number {
  const T = centuriesTT(jdUT(ms));
  return sunApparent(T).lon - nutation(T).dpsi - 1.3969713 * T;
}

/** The peak instant of a shower in a calendar year (UTC). */
export function showerPeak(s: Shower, year: number): number {
  // Start from the day the sun passes the longitude in a mean year (0° near 21 March).
  let t = Date.UTC(year, 2, 21) + (((s.lambda - 0 + 360) % 360) / 0.9856474) * DAY;
  if (new Date(t).getUTCFullYear() !== year) t -= 365.2422 * DAY;
  for (let i = 0; i < 8; i++) t += (norm180(s.lambda - lambdaJ2000(t)) / 0.9856474) * DAY;
  return t;
}

/** Altitude of a fixed radiant, deg. */
function radiantAlt(s: Shower, ms: number, lat: number, lon: number): number {
  const jd = jdUT(ms);
  return toHorizon(s.ra, s.dec, lat, gast(jd, centuriesTT(jd)) + lon).alt;
}

export interface ShowerNight {
  shower: Shower;
  peak: number;
  /** The span of that night with the radiant ≥ 25° and the sun below −12°. */
  from: number;
  to: number;
}

/**
 * The shower whose night is the local evening of `date` and the morning after, if one peaks nearest that night
 * and its radiant gets high enough while it is dark. One shower at most (they never share a night).
 */
export function showerNight(
  date: string,
  lat: number,
  lon: number,
  tz?: string,
): ShowerNight | null {
  const key = `${lat},${lon},${tz ?? ''},${date}`;
  if (memo.has(key)) return memo.get(key)!;
  const found = findNight(date, lat, lon, tz);
  if (memo.size >= 32) memo.delete(memo.keys().next().value!);
  memo.set(key, found);
  return found;
}

const memo = new Map<string, ShowerNight | null>();

function findNight(date: string, lat: number, lon: number, tz?: string): ShowerNight | null {
  const year = Number(date.slice(0, 4));
  for (const s of SHOWERS) {
    for (const y of [year - 1, year, year + 1]) {
      const peak = showerPeak(s, y);
      // The night nearest the peak: the one whose local midnight is nearest; its evening is the day before.
      const nightOf = localDate(peak - DAY / 2, tz);
      if (nightOf !== date) continue;
      const { start, end } = dayBounds(date, tz);
      const noon = (start + end) / 2;
      let from: number | null = null;
      let to = 0;
      for (let t = noon; t < noon + DAY; t += STEP) {
        if (sky(t, lat, lon, 15).sun.alt >= SUN_MAX) continue;
        if (radiantAlt(s, t, lat, lon) < RADIANT_MIN) continue;
        from ??= t;
        to = t;
      }
      if (from !== null) return { shower: s, peak, from, to };
    }
  }
  return null;
}
