import { describe, expect, it } from 'vitest';
import {
  aqiBand,
  compassIndex,
  parseAir,
  pollenLevel,
  pollenRows,
  rateAir,
  topLevel,
  type Air,
} from './air';

const hours = Array.from({ length: 48 }, (_, i) => {
  const d = i < 24 ? '2026-04-20' : '2026-04-21';
  return `${d}T${String(i % 24).padStart(2, '0')}:00`;
});

describe('parseAir', () => {
  it('reads the current values rounded and the day maxima of the pollen', () => {
    const air = parseAir({
      current: {
        european_aqi: 42.4,
        pm2_5: 8.46,
        pm10: 14.04,
        ozone: 61.2,
        nitrogen_dioxide: 12.7,
        sulphur_dioxide: 1.1,
        birch_pollen: 118.6,
        grass_pollen: 4.2,
        olive_pollen: null,
      },
      hourly: {
        time: hours,
        european_aqi: hours.map((_, i) => (i === 10 ? 55 : 30)),
        birch_pollen: hours.map((_, i) => (i === 14 ? 140 : i === 30 ? 20 : 0)),
        grass_pollen: hours.map(() => null),
      },
    })!;
    expect(air.now).toEqual({ aqi: 42, pm25: 8.5, pm10: 14, o3: 61, no2: 13, so2: 1 });
    expect(air.pollen).toEqual({ birch: 119, grass: 4 });
    expect(air.days.map((d) => d.date)).toEqual(['2026-04-20', '2026-04-21']);
    expect(air.days[0]).toMatchObject({ aqi: 55, pollen: { birch: 140 } });
    expect(air.days[1]!.pollen).toEqual({ birch: 20 });
  });

  it('a place without data is an empty answer, a wrong shape is no answer', () => {
    expect(parseAir({ current: { european_aqi: null } })).toEqual({
      now: expect.objectContaining({}),
      pollen: {},
      days: [],
    });
    expect(parseAir(undefined)).toBeUndefined();
    expect(parseAir({ current: { european_aqi: 'x' } })).toBeUndefined();
  });
});

describe('levels', () => {
  it('pollen levels follow the limits of the type', () => {
    expect(pollenLevel('birch', 0)).toBe('none');
    expect(pollenLevel('birch', 10)).toBe('low');
    expect(pollenLevel('birch', 50)).toBe('moderate');
    expect(pollenLevel('birch', 300)).toBe('high');
    expect(pollenLevel('birch', 2000)).toBe('veryHigh');
    expect(pollenLevel('grass', 30)).toBe('high');
    expect(pollenLevel('ragweed', 4)).toBe('moderate');
  });

  it('the air index has six bands', () => {
    expect([10, 30, 50, 70, 90, 150].map(aqiBand)).toEqual([
      'veryGood',
      'good',
      'fair',
      'poor',
      'veryPoor',
      'extreme',
    ]);
  });

  it('rows list the strongest first and topLevel is the highest', () => {
    const rows = pollenRows({ grass: 4, birch: 300, alder: 0 });
    expect(rows.map((r) => r.type)).toEqual(['birch', 'grass', 'alder']);
    expect(topLevel({ grass: 4, birch: 300 })).toBe('high');
    expect(topLevel({})).toBe('none');
  });
});

describe('rateAir (careful on purpose)', () => {
  const air = (aqi: number | undefined, pollen: Air['pollen'] = {}): Air => ({
    now: { aqi },
    pollen,
    days: [],
  });
  it('good, so-so and unpleasant', () => {
    expect(rateAir(air(20, { birch: 5 }))).toBe('good');
    expect(rateAir(air(45))).toBe('fair');
    expect(rateAir(air(20, { birch: 50 }))).toBe('fair');
    expect(rateAir(air(65))).toBe('poor');
    expect(rateAir(air(20, { grass: 60 }))).toBe('poor');
  });
  it('says nothing without any value', () => {
    expect(rateAir(undefined)).toBeUndefined();
    expect(rateAir(air(undefined))).toBeUndefined();
  });
});

describe('compassIndex', () => {
  it('maps degrees to eight points, wrapping around north', () => {
    expect([0, 44, 90, 180, 270, 315, 359, 360, -45].map(compassIndex)).toEqual([
      0, 1, 2, 4, 6, 7, 0, 0, 7,
    ]);
  });
});
