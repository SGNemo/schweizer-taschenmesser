/**
 * Lunar eclipses 2026–2050 from a shipped table (CONCEPT-EVENTS §1), with the local visibility from the moon's
 * altitude. Penumbral eclipses are left out (§3). No network.
 */
import { moonRiseSet } from './riseset';
import { refraction, sky } from './topo';

/** Source of the table (kept with the data). */
export const LUNAR_SOURCE = 'astronomy-engine 2.1.19 (MIT), generated 2026-11-24';

/** [peak UTC, p|a|t (penumbral, partial, total), semi-duration penumbral, partial, total (min), percent in the umbra]. */
const ROWS: readonly (readonly [string, string, number, number, number, number])[] = [
  ['2027-02-20T23:12Z', 'p', 121, 0, 0, 0],
  ['2027-07-18T16:02Z', 'p', 13, 0, 0, 0],
  ['2027-08-17T07:13Z', 'p', 110, 0, 0, 0],
  ['2028-01-12T04:13Z', 'a', 126, 29, 0, 3],
  ['2028-07-06T18:19Z', 'a', 156, 71, 0, 33],
  ['2028-12-31T16:51Z', 't', 168, 105, 36, 100],
  ['2029-06-26T03:22Z', 't', 168, 110, 51, 100],
  ['2029-12-20T22:41Z', 't', 179, 107, 27, 100],
  ['2030-06-15T18:33Z', 'a', 139, 73, 0, 47],
  ['2030-12-09T22:27Z', 'p', 140, 0, 0, 0],
  ['2031-05-07T03:50Z', 'p', 119, 0, 0, 0],
  ['2031-06-05T11:44Z', 'p', 49, 0, 0, 0],
  ['2031-10-30T07:45Z', 'p', 116, 0, 0, 0],
  ['2032-04-25T15:13Z', 't', 172, 106, 33, 100],
  ['2032-10-18T19:02Z', 't', 158, 98, 24, 100],
  ['2033-04-14T19:12Z', 't', 181, 108, 25, 100],
  ['2033-10-08T10:55Z', 't', 157, 102, 40, 100],
  ['2034-04-03T19:05Z', 'p', 133, 0, 0, 0],
  ['2034-09-28T02:46Z', 'a', 125, 15, 0, 0],
  ['2035-02-22T09:04Z', 'p', 128, 0, 0, 0],
  ['2035-08-19T01:10Z', 'a', 145, 39, 0, 5],
  ['2036-02-11T22:11Z', 't', 158, 101, 38, 100],
  ['2036-08-07T02:51Z', 't', 186, 116, 48, 100],
  ['2037-01-31T14:00Z', 't', 156, 99, 32, 100],
  ['2037-07-27T04:08Z', 'a', 171, 97, 0, 85],
  ['2038-01-21T03:48Z', 'p', 123, 0, 0, 0],
  ['2038-06-17T02:43Z', 'p', 89, 0, 0, 0],
  ['2038-07-16T11:34Z', 'p', 97, 0, 0, 0],
  ['2038-12-11T17:43Z', 'p', 130, 0, 0, 0],
  ['2039-06-06T18:53Z', 'a', 149, 90, 0, 93],
  ['2039-11-30T16:55Z', 'a', 180, 103, 0, 98],
  ['2040-05-26T11:44Z', 't', 161, 106, 46, 100],
  ['2040-11-18T19:03Z', 't', 177, 111, 44, 100],
  ['2041-05-16T00:41Z', 'a', 135, 30, 0, 3],
  ['2041-11-08T04:33Z', 'a', 134, 46, 0, 10],
  ['2042-04-05T14:28Z', 'p', 135, 0, 0, 0],
  ['2042-09-29T10:44Z', 'a', 120, 5, 0, 0],
  ['2043-03-25T14:30Z', 't', 180, 108, 27, 100],
  ['2043-09-19T01:50Z', 't', 163, 103, 36, 100],
  ['2044-03-13T19:37Z', 't', 170, 105, 34, 100],
  ['2044-09-07T11:19Z', 't', 172, 103, 18, 100],
  ['2045-03-03T07:41Z', 'p', 122, 0, 0, 0],
  ['2045-08-27T13:53Z', 'p', 121, 0, 0, 0],
  ['2046-01-22T13:01Z', 'a', 125, 26, 0, 2],
  ['2046-07-18T01:04Z', 'a', 149, 58, 0, 17],
  ['2047-01-12T01:24Z', 't', 169, 105, 35, 100],
  ['2047-07-07T10:34Z', 't', 167, 110, 51, 100],
  ['2048-01-01T06:52Z', 't', 180, 107, 29, 100],
  ['2048-06-26T02:00Z', 'a', 143, 80, 0, 64],
  ['2048-12-20T06:26Z', 'p', 141, 0, 0, 0],
  ['2049-05-17T11:25Z', 'p', 113, 0, 0, 0],
  ['2049-06-15T19:12Z', 'p', 67, 0, 0, 0],
  ['2049-11-09T15:50Z', 'p', 114, 0, 0, 0],
  ['2050-05-06T22:30Z', 't', 170, 103, 22, 100],
  ['2050-10-30T03:20Z', 't', 157, 97, 18, 100],
];

const MIN = 60000;

export interface LunarRow {
  /** Instant of the greatest eclipse (to the minute). */
  peak: number;
  kind: 'partial' | 'total';
  /** Umbral contacts U1 / U4 and, for a total eclipse, U2 / U3 (totality). */
  u1: number;
  u4: number;
  u2?: number;
  u3?: number;
  /** Percent of the disc in the umbra at the peak. */
  pct: number;
}

/** The table's umbral eclipses (penumbral rows dropped). */
export const LUNAR_ECLIPSES: readonly LunarRow[] = ROWS.filter((r) => r[1] !== 'p').map(
  ([iso, k, , par, tot, pct]) => {
    const peak = Date.parse(iso);
    return {
      peak,
      kind: k === 't' ? 'total' : 'partial',
      u1: peak - par * MIN,
      u4: peak + par * MIN,
      ...(k === 't' && { u2: peak - tot * MIN, u3: peak + tot * MIN }),
      pct,
    } satisfies LunarRow;
  },
);

/** Last instant the table covers: after it no lunar eclipse is announced. */
export const LUNAR_TABLE_END = Date.parse('2050-12-31T23:59:59Z');

export interface LocalLunarEclipse {
  row: LunarRow;
  /** Moon's apparent altitude at U1, the peak and U4, deg. */
  altU1: number;
  altPeak: number;
  altU4: number;
  /** Minutes of the umbral phase with the moon above the horizon. */
  upMin: number;
  /** Shown at the place: ≥ 10 % in the umbra and the moon up for ≥ 10 min of the umbral phase. */
  visible: boolean;
  /** The moon rises during the umbral phase (the beginning is not visible): moonrise. */
  risesLate?: number;
  /** The moon sets during the umbral phase (the end is not visible): moonset. */
  setsEarly?: number;
}

const moonAlt = (ms: number, lat: number, lon: number) => {
  const a = sky(ms, lat, lon).moon.alt;
  return a + refraction(a);
};

/** Local circumstances of one table row. */
export function localLunarEclipse(row: LunarRow, lat: number, lon: number): LocalLunarEclipse {
  const altU1 = moonAlt(row.u1, lat, lon);
  const altU4 = moonAlt(row.u4, lat, lon);
  const { rise, set } = moonRiseSet(row.u1, row.u4, lat, lon);
  // Up-time inside [U1, U4] from the state at U1 and the rise / set inside the window.
  let up = 0;
  let upAt = altU1 > 0 ? row.u1 : null;
  const marks = [
    ...(rise !== null ? [{ t: rise, r: true }] : []),
    ...(set !== null ? [{ t: set, r: false }] : []),
  ].sort((a, b) => a.t - b.t);
  for (const m of marks) {
    if (m.r && upAt === null) upAt = m.t;
    else if (!m.r && upAt !== null) {
      up += m.t - upAt;
      upAt = null;
    }
  }
  if (upAt !== null) up += row.u4 - upAt;
  const upMin = up / MIN;
  return {
    row,
    altU1,
    altPeak: moonAlt(row.peak, lat, lon),
    altU4,
    upMin,
    visible: row.pct >= 10 && upMin >= 10,
    ...(altU1 <= 0 && rise !== null && { risesLate: rise }),
    ...(altU4 <= 0 && set !== null && { setsEarly: set }),
  };
}

/** Rows whose umbral phase overlaps [fromMs, toMs). */
export function lunarEclipsesBetween(fromMs: number, toMs: number): LunarRow[] {
  return LUNAR_ECLIPSES.filter((r) => r.u4 > fromMs && r.u1 < toMs);
}

/** Share of the disc in the umbra at an instant, 0…1, linear between the contacts. */
export function umbraAt(ms: number, row: LunarRow): number {
  if (ms <= row.u1 || ms >= row.u4) return 0;
  if (row.u2 !== undefined && row.u3 !== undefined) {
    if (ms < row.u2) return (ms - row.u1) / (row.u2 - row.u1);
    if (ms <= row.u3) return 1;
    return (row.u4 - ms) / (row.u4 - row.u3);
  }
  const top = row.pct / 100;
  return ms <= row.peak
    ? (top * (ms - row.u1)) / (row.peak - row.u1)
    : (top * (row.u4 - ms)) / (row.u4 - row.peak);
}
