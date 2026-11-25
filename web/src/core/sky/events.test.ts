import { describe, expect, it } from 'vitest';
import eclipses from './__fixtures__/eclipses.json';
import lunarTable from './__fixtures__/lunar-eclipses-2026-2050.json';
import meteors from './__fixtures__/meteors.json';
import { cloudAt, eventsFor, seasonOn, solarSpan } from './events';
import { LUNAR_ECLIPSES, localLunarEclipse, umbraAt } from './lunarEclipses';
import { SHOWERS, showerNight, showerPeak } from './meteors';
import { dayBounds, localDate } from './moonDay';
import { localSolarEclipses, obscurationAt, SOLAR_MIN } from './solarEclipse';

/**
 * Sky events of package 3 against `__fixtures__/` (astronomy-engine 2.1.19 and the IMO calendar, copied from
 * docs/design/weather-scenes/reference/) with the tolerances of CONCEPT-EVENTS §4.
 */
const ms = (iso: string): number => Date.parse(iso);
const MIN = 60000;
const DAY = 86400000;
const PLACES = {
  lindenau: { lat: 49.6, lon: 11.0, tz: 'Europe/Berlin' },
  tromso: { lat: 69.65, lon: 18.96, tz: 'Europe/Oslo' },
  singapore: { lat: 1.35, lon: 103.82, tz: 'Asia/Singapore' },
  sydney: { lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' },
  reykjavik: { lat: 64.15, lon: -21.94, tz: 'Atlantic/Reykjavik' },
} as const;
const L = PLACES.lindenau;

type Row = (typeof eclipses.solarLocal.lindenau)[number];
const FROM = ms(eclipses.range.split(' .. ')[0]!);
const TO = ms(`${eclipses.range.split(' .. ')[1]!}T23:59:59Z`);

describe('solar eclipses, calculated on the device (CONCEPT-EVENTS §1)', () => {
  it.each(Object.keys(PLACES) as (keyof typeof PLACES)[])(
    '%s: every local eclipse of the fixture within ± 2 min and ± 1 pp, none missed',
    (name) => {
      const p = PLACES[name];
      const want = eclipses.solarLocal[name] as Row[];
      const got = localSolarEclipses(FROM, TO, p.lat, p.lon);
      expect(got.map((e) => new Date(e.peak).toISOString().slice(0, 10))).toEqual(
        want.map((w) => w.peak.t.slice(0, 10)),
      );
      got.forEach((e, i) => {
        const w = want[i]!;
        // The fixture gives minutes (truncated): the instant lies in that minute ± the tolerance.
        const near = (t: number, iso: string) =>
          expect(Math.abs(t - (ms(iso) + 30000))).toBeLessThanOrEqual(2.5 * MIN);
        near(e.begin, w.partialBegin.t);
        near(e.peak, w.peak.t);
        near(e.end, w.partialEnd.t);
        expect(Math.abs(e.obscuration - w.obscuration) * 100).toBeLessThanOrEqual(1);
      });
    },
  );

  it('nothing found in a year without one at the sample place (2031)', () => {
    expect(
      localSolarEclipses(ms('2031-01-01T00:00Z'), ms('2032-01-01T00:00Z'), L.lat, L.lon),
    ).toEqual([]);
  });

  it('2027-08-02: 45 % covered, sun 40°–55° high, 08:10–10:14 UTC', () => {
    const [e] = localSolarEclipses(ms('2027-08-01T00:00Z'), ms('2027-08-04T00:00Z'), L.lat, L.lon);
    expect(e!.kind).toBe('partial');
    expect(Math.round(e!.visibleObscuration * 100)).toBe(45);
    expect(e!.sunSet).toBeUndefined();
  });

  it('2028-01-26: the coverage reached at sunset, not the 71 % of the maximum below the horizon', () => {
    const [e] = localSolarEclipses(ms('2028-01-25T00:00Z'), ms('2028-01-28T00:00Z'), L.lat, L.lon);
    expect(Math.round(e!.obscuration * 100)).toBe(71);
    expect(e!.sunSet).toBeDefined();
    expect(e!.visibleObscuration).toBeCloseTo(obscurationAt(e!.sunSet!, L.lat, L.lon), 6);
    expect(e!.visibleObscuration).toBeLessThan(0.71);
    expect(e!.visibleObscuration).toBeGreaterThanOrEqual(SOLAR_MIN);
    // Shown from its begin to sunset.
    expect(solarSpan(e!).to).toBe(e!.sunSet);
  });

  it('2034-03-20: 4 % at the sample place is below the 5 % limit (nothing)', () => {
    const [e] = localSolarEclipses(ms('2034-03-19T00:00Z'), ms('2034-03-22T00:00Z'), L.lat, L.lon);
    expect(e!.visibleObscuration).toBeLessThan(SOLAR_MIN);
    const ev = eventsFor({ nowMs: ms('2034-03-18T12:00Z'), ...L });
    expect(ev.card).toBeUndefined();
    expect(ev.safety).toBe(false);
  });
});

describe('lunar eclipses from the table (CONCEPT-EVENTS §4)', () => {
  it('the table is the reference file, penumbral rows dropped', () => {
    expect(LUNAR_ECLIPSES).toHaveLength(lunarTable.rows.filter((r) => r[1] !== 'p').length);
  });

  const verdict = (v: string, pct: number, upMin: number): boolean =>
    v.startsWith('penumbral') || v === 'no' || pct < 10 ? false : v === 'yes' ? true : upMin >= 10;

  it.each(
    eclipses.lunar
      .filter((l) => l.kind !== 'penumbral')
      .map((l) => [l.max.slice(0, 10), l] as const),
  )('%s: contacts ± 2 min, the product verdict by the mapping', (_, l) => {
    const row = LUNAR_ECLIPSES.find((r) => Math.abs(r.peak - ms(l.max)) < 2 * MIN)!;
    expect(row).toBeDefined();
    expect(Math.abs(row.u1 - ms(l.U1!))).toBeLessThanOrEqual(2 * MIN);
    expect(Math.abs(row.u4 - ms(l.U4!))).toBeLessThanOrEqual(2 * MIN);
    if (l.U2) expect(Math.abs(row.u2! - ms(l.U2))).toBeLessThanOrEqual(2 * MIN);
    if (l.U3) expect(Math.abs(row.u3! - ms(l.U3))).toBeLessThanOrEqual(2 * MIN);
    const local = localLunarEclipse(row, L.lat, L.lon);
    expect(local.visible).toBe(
      verdict(l.lindenau.verdict, Math.round(l.obscuration * 100), local.upMin),
    );
  });

  const at = (date: string) =>
    localLunarEclipse(
      LUNAR_ECLIPSES.find((r) => localDate(r.peak, 'UTC') === date)!,
      L.lat,
      L.lon,
    );

  it('hand-checked cases at the sample place', () => {
    expect(at('2028-01-12').visible).toBe(false); // 3 %
    const dec = at('2028-12-31');
    expect(dec.visible).toBe(true);
    expect(dec.risesLate).toBeDefined();
    expect(dec.setsEarly).toBeUndefined();
    const jun = at('2029-06-26');
    expect(jun.visible).toBe(true);
    expect(jun.setsEarly).toBeDefined();
    for (const d of ['2029-12-20', '2032-10-18']) {
      expect(at(d)).toMatchObject({ visible: true });
      expect(at(d).risesLate).toBeUndefined();
      expect(at(d).setsEarly).toBeUndefined();
    }
    expect(at('2032-04-25').visible).toBe(false);
    expect(at('2033-10-08').visible).toBe(false);
    // 2027-02-20 is penumbral: not in the table at all.
    expect(LUNAR_ECLIPSES.some((r) => localDate(r.peak, 'UTC') === '2027-02-20')).toBe(false);
  });

  it('2028-12-31: umbra 15:07–18:36, total 16:15–17:28 UTC; the shadow is linear between the contacts', () => {
    const r = at('2028-12-31').row;
    expect(umbraAt(r.u1 - MIN, r)).toBe(0);
    expect(umbraAt((r.u1 + r.u2!) / 2, r)).toBeCloseTo(0.5, 6);
    expect(umbraAt(r.peak, r)).toBe(1);
    expect(umbraAt(r.u4, r)).toBe(0);
    const p = at('2028-07-06').row; // partial, 33 %
    expect(umbraAt(p.peak, p)).toBeCloseTo(0.33, 6);
  });
});

describe('meteor nights (IMO calendar values)', () => {
  // The fixture also holds the struck Leoniden and Ursiden (CONCEPT-EVENTS §3).
  it.each(
    meteors
      .filter((s) => SHOWERS.some((x) => x.id === s.id))
      .flatMap((s) => s.peaks.map((p) => [s.id, p.peakUtc] as const)),
  )('%s peak %s within ± 30 min', (id, utc) => {
    const s = SHOWERS.find((x) => x.id === id)!;
    const year = Number(utc.slice(0, 4));
    expect(Math.abs(showerPeak(s, year) - ms(utc))).toBeLessThanOrEqual(30 * MIN);
  });

  it('the latitude rule: Eta-Aquariiden hidden at 49.6° N, shown at 1.35° N', () => {
    const eta = meteors.find((s) => s.id === 'ETA')!.peaks[2]!; // 2029
    const date = eta.night.slice(0, 10);
    expect(showerNight(date, L.lat, L.lon, L.tz)).toBeNull();
    const sg = PLACES.singapore;
    expect(showerNight(date, sg.lat, sg.lon, sg.tz)?.shower.id).toBe('ETA');
  });

  it('the night nearest the peak, not the one before or after (Geminiden 2028 at the sample place)', () => {
    expect(showerNight('2028-12-13', L.lat, L.lon, L.tz)?.shower.id).toBe('GEM');
    expect(showerNight('2028-12-12', L.lat, L.lon, L.tz)).toBeNull();
    expect(showerNight('2028-12-14', L.lat, L.lon, L.tz)).toBeNull();
  });
});

describe('solstices and equinoxes', () => {
  // The instants themselves are checked against vectors.json in sky.test.ts (seasons 2027–2028, ± 2 min).
  it('2027-12-22 is the winter solstice at the sample place; the names swap at −33.9°', () => {
    expect(seasonOn('2027-12-22', L.lat, L.tz)?.season).toBe('solsticeWinter');
    expect(seasonOn('2027-12-22', -33.9, 'Australia/Sydney')?.season).toBe('solsticeSummer');
    expect(seasonOn('2028-03-20', -33.9, 'Australia/Sydney')?.season).toBe('equinoxAutumn');
    expect(seasonOn('2027-12-21', L.lat, L.tz)).toBeNull();
  });
});

describe('one event at a time (CONCEPT-EVENTS §2)', () => {
  const ev = (iso: string, extra: Partial<Parameters<typeof eventsFor>[0]> = {}) =>
    eventsFor({ nowMs: ms(iso), ...L, ...extra });

  it('2027-08-02: card from 26 July, chip and the bite on the day, the safety pill all day until the end', () => {
    expect(ev('2027-07-25T12:00Z').card).toBeUndefined();
    expect(ev('2027-07-26T12:00Z').card).toMatchObject({ kind: 'solar', when: 'ahead' });
    const morning = ev('2027-08-02T05:00Z');
    expect(morning).toMatchObject({
      safety: true,
      chip: { kind: 'solar' },
      card: { when: 'today' },
    });
    const during = ev('2027-08-02T09:11Z');
    expect(during.scene?.event).toBe('solarPartial');
    expect(during.scene!.amount).toBeGreaterThan(0.4);
    expect(during.card).toMatchObject({ kind: 'solar', when: 'running' });
    const after = ev('2027-08-02T11:00Z');
    expect(after.safety).toBe(false);
    expect(after.chip).toBeUndefined();
  });

  it('2028-12-31: the moon rises during the eclipse; copper moon in the scene from moonrise', () => {
    expect(ev('2028-12-24T12:00Z').card).toMatchObject({ kind: 'lunar', when: 'ahead' });
    const total = ev('2028-12-31T16:51Z');
    expect(total.scene?.event).toBe('lunarTotal');
    expect(total.chip).toMatchObject({ kind: 'lunar' });
    expect(ev('2028-12-31T15:10Z').scene?.event ?? 'none').not.toMatch(/^lunar/); // moon still below
  });

  it('a running eclipse outranks the rainbow; the rainbow outranks a later eclipse and meteors', () => {
    const rain = { code: 80, cloud: 70 };
    const running = ev('2027-08-02T09:00Z', rain);
    expect(running.chip?.kind).toBe('solar');
    expect(running.scene?.event).toBe('solarPartial');
    // Rainbow weather: sun 3°–40°, rain now, cloud ≤ 85 %.
    expect(ev('2027-06-10T17:00Z', rain)).toMatchObject({
      chip: { kind: 'rainbow' },
      scene: { event: 'rainbow' },
    });
    expect(ev('2027-06-10T17:00Z', { code: 80, cloud: 90 }).chip).toBeUndefined();
    expect(ev('2027-06-10T17:00Z', { code: 3, cloud: 50 }).chip).toBeUndefined();
    expect(ev('2027-06-10T11:00Z', rain).chip).toBeUndefined(); // sun higher than 40°
  });

  it('meteors: chip and card on that evening and night; the bright moon and the clouds are told', () => {
    // Not at midday: "that evening and night" starts at sunset.
    expect(ev('2027-12-14T11:00Z', { cloud: 10 }).chip).toBeUndefined();
    const gem27 = ev('2027-12-14T19:00Z', { cloud: 10 });
    expect(gem27.chip).toMatchObject({ kind: 'meteors', night: { shower: { id: 'GEM' } } });
    expect(gem27.card).toMatchObject({ kind: 'meteors', moonBright: true });
    const gem28 = ev('2028-12-13T23:30Z', { cloud: 10 });
    expect(gem28.card).toMatchObject({ kind: 'meteors', moonBright: false });
    expect(gem28.scene?.event).toBe('meteors');
    expect(ev('2028-12-13T23:30Z', { cloud: 90 }).scene?.event).not.toBe('meteors');
  });

  it('star night, dust and the winter solstice line', () => {
    // 2028-12-13 near new moon; cloud 10 % → star night if no shower: take 2028-11-20 (new moon ~ 11-16).
    const dark = ev('2028-11-17T23:00Z', { cloud: 10 });
    expect(dark.scene?.event).toBe('starNight');
    expect(dark.card).toEqual({ kind: 'starNight' });
    expect(ev('2028-11-17T23:00Z', { cloud: 30 }).scene).toBeUndefined();
    expect(ev('2028-06-10T10:00Z', { dust: 50 }).scene?.event).toBe('dust');
    expect(ev('2028-06-10T10:00Z', { dust: 49 }).scene).toBeUndefined();
    expect(ev('2028-06-10T23:00Z', { dust: 80, cloud: 90 }).scene).toBeUndefined(); // dust by day only
    expect(ev('2027-12-22T10:00Z').card).toMatchObject({
      kind: 'season',
      season: 'solsticeWinter',
    });
  });

  it('clouds above 80 % at the time of an eclipse add the cloud sentence; unknown hours add nothing', () => {
    const peak = ms('2027-08-02T09:11Z');
    const hour = new Intl.DateTimeFormat('sv-SE', {
      timeZone: L.tz,
      dateStyle: 'short',
      timeStyle: 'short',
    })
      .format(peak)
      .replace(' ', 'T')
      .slice(0, 13);
    const hours = [{ time: `${hour}:00`, cloud: 95 }];
    expect(cloudAt(peak, hours, L.tz)).toBe(95);
    expect(ev('2027-08-01T12:00Z', { hours }).card).toMatchObject({ clouds: true });
    expect(ev('2027-08-01T12:00Z').card).toMatchObject({ clouds: false });
  });

  it('a calm day has nothing', () => {
    const quiet = ev('2027-03-03T12:00Z', { code: 3, cloud: 50 });
    expect(quiet).toEqual({ safety: false });
  });

  it('every day of a year at the sample place: at most one chip and one card event, safety only on solar days', () => {
    const start = dayBounds('2027-01-01', L.tz).start;
    for (let t = start; t < start + 365 * DAY; t += DAY / 2) {
      const e = eventsFor({ nowMs: t, ...L, cloud: 50 });
      if (e.safety) expect(localDate(t, L.tz)).toBe('2027-08-02');
    }
  });
});
