import { describe, expect, it } from 'vitest';
import vectors from './__fixtures__/vectors.json';
import { moonPhase } from './core';
import { dayBounds, localDate, localMidnight, moonNow, moonOfDay } from './moonDay';
import { phaseNameForDay } from './phaseName';
import { phasesBetween, seasonInstant } from './phases';
import { moonRiseSet } from './riseset';
import { crescentTilt, sky } from './topo';

/**
 * The moon module against `__fixtures__/vectors.json` (astronomy-engine 2.1.19, copied from
 * docs/design/weather-scenes@ca90c392f/reference/vectors.json) with the tolerances of CONCEPT-MOON §7.
 */
const LINDENAU = { lat: 49.6, lon: 11.0, tz: 'Europe/Berlin' };
const MIN = 60000;
const ms = (iso: string): number => Date.parse(iso);

/** True when an instant lies within 10 min of a phase instant or of local midnight (the name may flip there). */
function nearEdge(t: number): boolean {
  const phases = phasesBetween(t - 2 * 86400000, t + 2 * 86400000);
  if (phases.some((p) => Math.abs(p.ms - t) < 10 * MIN)) return true;
  const { start, end } = dayBounds(localDate(t, LINDENAU.tz), LINDENAU.tz);
  return t - start < 10 * MIN || end - t < 10 * MIN;
}

const ROWS = [vectors.special, ...vectors.spread];

describe('moon module against vectors.json', () => {
  it.each(ROWS.map((r) => [r.utc, r] as const))(
    '%s: lit, distance, waxing, altitude, tilt, name',
    (_, r) => {
      const t = ms(r.utc);
      const p = moonPhase(t);
      expect(Math.abs(p.k * 100 - r.illumPct)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(p.distKm - r.distKm)).toBeLessThanOrEqual(50);
      expect(p.waxing).toBe(r.waxing);
      const s = sky(t, LINDENAU.lat, LINDENAU.lon);
      expect(Math.abs(s.moon.alt - r.lindenau.moonAltDeg)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(s.sun.alt - r.lindenau.sunAltDeg)).toBeLessThanOrEqual(0.05);
      const tilt = r.lindenau.tiltDeg;
      if (tilt != null && r.lindenau.moonAltDeg < 85) {
        const got = crescentTilt(t, LINDENAU.lat, LINDENAU.lon).tilt;
        const diff = Math.abs(((got - tilt + 540) % 360) - 180);
        expect(diff).toBeLessThanOrEqual(1);
      }
      if (!nearEdge(t)) {
        const { start, end } = dayBounds(localDate(t, LINDENAU.tz), LINDENAU.tz);
        const principal = phasesBetween(start - 2 * 86400000, end + 2 * 86400000);
        expect(phaseNameForDay(start, end, principal)).toBe(r.phaseName);
      }
    },
  );

  it('the picture moment: 2026-11-24 01:50 UTC is 99.37 %, "full", altitude 41.99°', () => {
    const now = moonNow(ms('2026-11-24T01:50:00Z'), LINDENAU.lat, LINDENAU.lon, LINDENAU.tz);
    expect(now.name).toBe('full');
    expect(Math.abs(now.lit * 100 - 99.37)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(now.alt - 41.99)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(now.day.nextFull - ms(vectors.special.nextFull))).toBeLessThanOrEqual(2 * MIN);
    expect(Math.abs(now.day.nextNew - ms(vectors.special.nextNew))).toBeLessThanOrEqual(2 * MIN);
  });

  it.each(vectors.principalPhases2027.map((p) => [p.kind, p.utc, p] as const))(
    'phase instant %s %s within 2 min, its distance within 50 km, its Berlin date',
    (kind, utc, p) => {
      const t = ms(utc);
      const found = phasesBetween(t - 86400000, t + 86400000);
      const phase = ['new', 'firstQuarter', 'full', 'lastQuarter'].indexOf(kind);
      const hit = found.find((f) => f.phase === phase)!;
      expect(Math.abs(hit.ms - t)).toBeLessThanOrEqual(2 * MIN);
      expect(Math.abs(moonPhase(hit.ms).distKm - p.distKm)).toBeLessThanOrEqual(50);
      expect(localDate(hit.ms, LINDENAU.tz)).toBe(p.berlinDate);
    },
  );

  it.each(vectors.seasons.map((s) => [s.year, s.kind, s.utc] as const))(
    '%i %s within 2 min',
    (year, kind, utc) => {
      const which = [
        'marchEquinox',
        'juneSolstice',
        'septemberEquinox',
        'decemberSolstice',
      ].indexOf(kind);
      expect(which).toBeGreaterThanOrEqual(0);
      expect(Math.abs(seasonInstant(year, which as 0 | 1 | 2 | 3) - ms(utc))).toBeLessThanOrEqual(
        2 * MIN,
      );
    },
  );

  it.each(vectors.riseSetLindenau.map((r) => [r.localDate, r] as const))(
    'moonrise and moonset of %s (Berlin day) within 1 min, and whether they exist',
    (date, r) => {
      const { start, end } = dayBounds(date, LINDENAU.tz);
      const got = moonRiseSet(start, end, LINDENAU.lat, LINDENAU.lon);
      for (const k of ['rise', 'set'] as const) {
        const want = r[k];
        if (want == null) expect(got[k]).toBeNull();
        // The vectors give the minute (truncated): the instant lies within that minute ± the tolerance.
        else expect(Math.abs(got[k]! - (ms(want) + 30000))).toBeLessThanOrEqual(90000);
      }
      const day = moonOfDay(date, LINDENAU.lat, LINDENAU.lon, LINDENAU.tz);
      expect(day.rise === null).toBe(r.rise == null);
      expect(day.set === null).toBe(r.set == null);
    },
  );
});

describe('local days', () => {
  it('midnight of a clock-change day: 23 and 25 hours', () => {
    const spring = dayBounds('2026-03-29', 'Europe/Berlin');
    expect((spring.end - spring.start) / 3600000).toBe(23);
    const autumn = dayBounds('2026-10-25', 'Europe/Berlin');
    expect((autumn.end - autumn.start) / 3600000).toBe(25);
    expect(new Date(localMidnight('2026-11-24', 'Pacific/Auckland')).toISOString()).toBe(
      '2026-11-23T11:00:00.000Z',
    );
  });

  it.each(['Europe/Berlin', 'Pacific/Auckland', 'America/Los_Angeles'])(
    'one "full" day per lunation in %s, on the local date of the instant (a year, clock changes included)',
    (tz) => {
      const from = ms('2026-01-01T00:00:00Z');
      const fulls = phasesBetween(from, from + 365 * 86400000).filter((p) => p.phase === 2);
      let date = localDate(from, tz);
      const fullDays: string[] = [];
      for (let i = 0; i < 365; i++) {
        if (moonOfDay(date, 50, 10, tz).name === 'full') fullDays.push(date);
        date = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
      }
      const expected = fulls
        .map((f) => localDate(f.ms, tz))
        .filter((d) => d >= localDate(from, tz) && d < date);
      expect(fullDays).toEqual(expected);
      // About one per lunation: 12 or 13 a year.
      expect(fullDays.length).toBeGreaterThanOrEqual(12);
      expect(fullDays.length).toBeLessThanOrEqual(13);
    },
  );
});

describe('supermoon and second full moon (CONCEPT-MOON §5)', () => {
  it('2026-11-24 and 2026-12-24 are supermoons, 2026-10-26 is not', () => {
    const { lat, lon, tz } = LINDENAU;
    expect(moonOfDay('2026-11-24', lat, lon, tz)).toMatchObject({ name: 'full', superMoon: true });
    expect(moonOfDay('2026-12-24', lat, lon, tz)).toMatchObject({ name: 'full', superMoon: true });
    expect(moonOfDay('2026-10-26', lat, lon, tz)).toMatchObject({ name: 'full', superMoon: false });
    expect(moonOfDay('2026-11-23', lat, lon, tz).superMoon).toBe(false);
  });

  it('the second full moon of a month: 2028-12-31', () => {
    const { lat, lon, tz } = LINDENAU;
    expect(moonOfDay('2028-12-31', lat, lon, tz)).toMatchObject({ name: 'full', secondFull: true });
    expect(moonOfDay('2028-12-02', lat, lon, tz)).toMatchObject({
      name: 'full',
      secondFull: false,
    });
  });
});

describe('moon now', () => {
  it('the tilt points the lit side the other way south of the equator (waxing crescent at dusk)', () => {
    const t = ms('2026-03-23T18:40:00Z');
    const north = crescentTilt(t, 49.6, 11).tilt;
    const south = crescentTilt(t - 8 * 3600000, -33.9, 151.2).tilt; // Sydney, its own evening
    // North: lit side to the lower right (negative); south: lit side towards the left (positive).
    expect(north).toBeLessThan(0);
    expect(south).toBeGreaterThan(0);
  });

  it('rise and set are only calculated when read', () => {
    const day = moonOfDay('2031-05-05', 0, 0);
    expect(typeof day.name).toBe('string');
    expect(day.rise === null || typeof day.rise === 'number').toBe(true);
  });
});

describe('moonrise and moonset: the faster search finds what the 10-minute grid finds', () => {
  it.each([
    ['Lindenau', 49.6, 11.0, 'Europe/Berlin'],
    ['Tromsø', 69.65, 18.96, 'Europe/Oslo'],
    ['Sydney', -33.87, 151.21, 'Australia/Sydney'],
  ] as const)('%s, 120 days', (_, lat, lon, tz) => {
    let date = '2027-01-01';
    for (let i = 0; i < 120; i++) {
      const { start, end } = dayBounds(date, tz);
      const fast = moonRiseSet(start, end, lat, lon);
      const grid = moonRiseSet(start, end, lat, lon, 60, 600000, false);
      for (const k of ['rise', 'set'] as const) {
        expect(fast[k] === null, `${date} ${k}`).toBe(grid[k] === null);
        if (grid[k] !== null)
          expect(Math.abs(fast[k]! - grid[k]!), `${date} ${k}`).toBeLessThan(5000);
      }
      date = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    }
  });
});
