import { describe, expect, it } from 'vitest';
import { dayBounds } from './moonDay';
import { civilTwilight, sunAltitude } from './twilight';

const clockMin = (ms: number, tz: string) => {
  const s = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: tz,
  }).format(ms);
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
};
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** Sunrise and sunset by the same altitude (−0.833°: refraction and the sun's radius), minute by minute. */
function riseSet(date: string, lat: number, lon: number, tz: string) {
  const { start, end } = dayBounds(date, tz);
  let rise = 0;
  let set = 0;
  let prev = sunAltitude(start, lat, lon);
  for (let ms = start + 60_000; ms < end; ms += 60_000) {
    const a = sunAltitude(ms, lat, lon);
    if (prev < -0.833 && a >= -0.833) rise = ms;
    if (prev >= -0.833 && a < -0.833) set = ms;
    prev = a;
  }
  return { rise, set };
}

describe('civil twilight (sun at −6°)', () => {
  it.each([
    // Published sunrise and sunset of the place (within 3 minutes: no height, standard refraction), and how long
    // civil twilight lasts there in that season.
    ['Bern, 26 Nov', '2026-11-26', 46.95, 7.45, 'Europe/Zurich', '07:48', '16:44', [30, 40]],
    ['Bern, 21 Jun', '2026-06-21', 46.95, 7.45, 'Europe/Zurich', '05:35', '21:29', [36, 45]],
    [
      'Sydney, 21 Dec',
      '2026-12-21',
      -33.87,
      151.21,
      'Australia/Sydney',
      '05:41',
      '20:05',
      [25, 32],
    ],
  ] as const)('%s', (_, date, lat, lon, tz, sunrise, sunset, [lo, hi]) => {
    const { rise, set } = riseSet(date, lat, lon, tz);
    expect(Math.abs(clockMin(rise, tz) - hm(sunrise))).toBeLessThanOrEqual(3);
    expect(Math.abs(clockMin(set, tz) - hm(sunset))).toBeLessThanOrEqual(3);
    const t = civilTwilight(date, lat, lon, tz);
    const before = (rise - t.dawn!) / 60_000;
    const after = (t.dusk! - set) / 60_000;
    for (const m of [before, after]) {
      expect(m).toBeGreaterThanOrEqual(lo);
      expect(m).toBeLessThanOrEqual(hi);
    }
    // The crossing is refined: the altitude there is −6° to a hundredth of a degree.
    expect(sunAltitude(t.dawn!, lat, lon)).toBeCloseTo(-6, 1);
  });

  it('is null where the sun never crosses −6° that day', () => {
    // Longyearbyen in polar night (always below), Tromsø at midsummer (always above).
    expect(civilTwilight('2026-12-21', 78.22, 15.65, 'Arctic/Longyearbyen')).toEqual({
      dawn: null,
      dusk: null,
    });
    expect(civilTwilight('2026-06-21', 69.65, 18.96, 'Europe/Oslo')).toEqual({
      dawn: null,
      dusk: null,
    });
  });
});
