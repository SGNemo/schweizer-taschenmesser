// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import live from './__fixtures__/kp-forecast-2026-11-25.json';
import {
  auroraTonight,
  geomagneticLatitude,
  kpNeeded,
  parseKp,
  readKp,
  refreshKp,
  SWPC_KP_URL,
} from './aurora';

/**
 * Aurora (handoff/03b test 4). Geomagnetic latitude: centred dipole with the pole at 80.8° N, 72.8° W
 * (CONCEPT-SOURCES §2). The only published reference at hand is the sample place's 49.7° that CONCEPT-SOURCES names;
 * the other four values pin the formula's output (regression values, rounded), and the Kp needs are the concept's
 * (sample place 7, Tromsø 0, Singapore never).
 */
const PLACES = {
  Lindenau: [49.6, 11.0, 49.7, 7],
  Tromsø: [69.65, 18.96, 67.5, 0],
  Reykjavik: [64.15, -21.94, 68.8, 0],
  Sydney: [-33.87, 151.21, -40.2, undefined],
  Singapore: [1.35, 103.82, -7.8, undefined],
} as const;

describe('where an aurora can be seen at all', () => {
  it.each(Object.entries(PLACES))(
    '%s: geomagnetic latitude ± 0.5°, Kp needed',
    (_, [lat, lon, gm, need]) => {
      expect(Math.abs(geomagneticLatitude(lat, lon) - gm)).toBeLessThanOrEqual(0.5);
      if (need === undefined || need > 9) expect(kpNeeded(lat, lon)).toBeUndefined();
      else expect(kpNeeded(lat, lon)).toBe(need);
    },
  );
});

describe('the SWPC file', () => {
  it('the live layout of 2026-11-25 (objects) and the older one (first row = keys)', () => {
    const a = parseKp(live)!;
    expect(a).toHaveLength(live.length);
    expect(a[0]).toEqual({ at: Date.parse('2026-11-18T00:00:00Z'), kp: 2.33 });
    const rows = [
      ['time_tag', 'kp', 'observed', 'noaa_scale'],
      ['2026-11-25 18:00:00', '3.33', 'estimated', null],
      ['2026-11-25 21:00:00', '4.00', 'predicted', null],
    ];
    expect(parseKp(rows)).toEqual([
      { at: Date.parse('2026-11-25T18:00:00Z'), kp: 3.33 },
      { at: Date.parse('2026-11-25T21:00:00Z'), kp: 4 },
    ]);
    expect(parseKp({ x: 1 })).toBeUndefined();
  });
});

describe('aurora tonight', () => {
  const T = Date.parse('2026-11-25T15:00:00Z');
  const steps = (kp: number) =>
    Array.from({ length: 8 }, (_, i) => ({
      at: Date.parse('2026-11-25T15:00:00Z') + i * 3 * 3600000,
      kp,
    }));

  it('the sample place needs Kp 7: none at 6, 0.4 at 7, 0.7 at 8, 1 at 9; only in the dark hours', () => {
    const [lat, lon] = PLACES.Lindenau;
    expect(auroraTonight(steps(6), lat, lon, T)).toBeUndefined();
    const a = auroraTonight(steps(7), lat, lon, T)!;
    expect(a.strength).toBe(0.4);
    expect(auroraTonight(steps(8), lat, lon, T)!.strength).toBe(0.7);
    expect(auroraTonight(steps(9), lat, lon, T)!.strength).toBe(1);
    // Dark (sun below −12°) from about 17:30 to 05:30 local in late November.
    expect(new Date(a.from).toISOString() > '2026-11-25T16:00').toBe(true);
    expect(new Date(a.to).toISOString() <= '2026-11-26T05:30:00.000Z').toBe(true);
  });

  it('polar day has no dark hours: nothing (Tromsø in June)', () => {
    const [lat, lon] = PLACES.Tromsø;
    const june = Date.parse('2027-06-21T12:00:00Z');
    const s = Array.from({ length: 8 }, (_, i) => ({ at: june + i * 3 * 3600000, kp: 9 }));
    expect(auroraTonight(s, lat, lon, june)).toBeUndefined();
  });
});

describe('the request', () => {
  beforeEach(() => {
    localStorage.clear();
    setNow(() => Date.parse('2026-11-25T15:00:00Z'));
  });
  afterEach(() => {
    setNow();
    vi.unstubAllGlobals();
  });
  const ok = () =>
    vi.fn(
      async () => new Response(JSON.stringify(live), { status: 200 }),
    ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

  it('the URL carries nothing; asked only with the switch on, for a place that can see one, online; every 3 h', async () => {
    const f = ok();
    await refreshKp(49.6, 11, false, f);
    await refreshKp(1.35, 103.82, true, f); // Singapore never needs the file
    vi.stubGlobal('navigator', { onLine: false });
    await refreshKp(49.6, 11, true, f);
    vi.unstubAllGlobals();
    expect(f).not.toHaveBeenCalled();
    await refreshKp(49.6, 11, true, f);
    expect(f).toHaveBeenCalledWith(SWPC_KP_URL, expect.anything());
    expect(new URL(SWPC_KP_URL).search).toBe('');
    expect(readKp()).toHaveLength(live.length);
    await refreshKp(49.6, 11, true, f);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
