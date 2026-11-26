import { describe, expect, it } from 'vitest';
import { tWeather } from '@/strings.weather';
import { codeGroup, type CodeGroup } from './logic';
import type { Forecast } from './api';
import {
  conditionId,
  condOf,
  frostLevel,
  moonArcT,
  phaseOf,
  sceneAddition,
  sceneOf,
  seasonOf,
  skyKey,
  SKY_KEYS,
  inkForSky,
  inkOf,
  windLevel,
  WMO_CODES,
  type MoonInput,
  type SceneEvent,
  type SceneState,
} from './scene';

/** Every code Open-Meteo documents for `weather_code` (WMO 4677 subset). */
const OPEN_METEO_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99,
];
const GROUPS = Object.keys(tWeather.de.codes) as CodeGroup[];

describe('conditionId', () => {
  it('has an id for every Open-Meteo code, and only for those', () => {
    expect([...WMO_CODES].sort((a, b) => a - b)).toEqual(OPEN_METEO_CODES);
  });

  it.each([
    [0, 'clear', 'klar', 'clear'],
    [1, 'mostlyClear', 'überwiegend klar', 'mostly clear'],
    [2, 'partly', 'leicht bewölkt', 'partly cloudy'],
    [3, 'overcast', 'bedeckt', 'overcast'],
    [45, 'fog', 'Nebel', 'fog'],
    [48, 'rimeFog', 'Nebel mit Reif', 'freezing fog'],
    [51, 'drizzle', 'Nieselregen', 'drizzle'],
    [53, 'drizzle', 'Nieselregen', 'drizzle'],
    [55, 'drizzle', 'Nieselregen', 'drizzle'],
    [56, 'freezingDrizzle', 'gefrierender Niesel', 'freezing drizzle'],
    [57, 'freezingDrizzle', 'gefrierender Niesel', 'freezing drizzle'],
    [61, 'rainLight', 'leichter Regen', 'light rain'],
    [63, 'rain', 'Regen', 'rain'],
    [65, 'rainHeavy', 'starker Regen', 'heavy rain'],
    [66, 'freezingRain', 'gefrierender Regen', 'freezing rain'],
    [67, 'freezingRain', 'gefrierender Regen', 'freezing rain'],
    [71, 'snowLight', 'leichter Schneefall', 'light snow'],
    [73, 'snow', 'Schneefall', 'snow'],
    [75, 'snowHeavy', 'starker Schneefall', 'heavy snow'],
    [77, 'snowGrains', 'Schneegriesel', 'snow grains'],
    [80, 'showersLight', 'leichte Schauer', 'light showers'],
    [81, 'showers', 'Schauer', 'showers'],
    [82, 'showersHeavy', 'heftige Schauer', 'heavy showers'],
    [85, 'snowShowers', 'Schneeschauer', 'snow showers'],
    [86, 'snowShowers', 'Schneeschauer', 'snow showers'],
    [95, 'thunder', 'Gewitter', 'thunderstorm'],
    [96, 'thunderHail', 'Gewitter mit Hagel', 'thunderstorm with hail'],
    [99, 'thunderHail', 'Gewitter mit Hagel', 'thunderstorm with hail'],
  ] as const)('code %i → %s (%s / %s)', (code, id, de, en) => {
    expect(conditionId(code, codeGroup(code))).toBe(id);
    expect(tWeather.de.conditions[id]).toBe(de);
    expect(tWeather.en.conditions[id]).toBe(en);
  });

  it('without a code: the group’s nearest word', () => {
    const byGroup = Object.fromEntries(GROUPS.map((g) => [g, conditionId(undefined, g)]));
    expect(byGroup).toEqual({
      clear: 'clear',
      partly: 'partly',
      cloudy: 'overcast',
      fog: 'fog',
      drizzle: 'drizzle',
      rain: 'rain',
      showers: 'showers',
      snow: 'snow',
      thunder: 'thunder',
    });
    // The group's old word and the new one agree where no code is known.
    for (const g of GROUPS)
      if (g !== 'snow')
        expect(tWeather.de.conditions[conditionId(undefined, g)]).toBe(tWeather.de.codes[g]);
  });

  it('an unknown code falls back to its group', () => {
    expect(conditionId(4, 'cloudy')).toBe('overcast');
  });

  it('German and English have a word for every id', () => {
    expect(Object.keys(tWeather.en.conditions).sort()).toEqual(
      Object.keys(tWeather.de.conditions).sort(),
    );
    for (const w of [
      ...Object.values(tWeather.de.conditions),
      ...Object.values(tWeather.en.conditions),
    ])
      expect(w.length).toBeGreaterThan(0);
  });
});

describe('sceneAddition (one extra word, by priority)', () => {
  const base = { id: 'clear' as const, temp: 10 };
  it('gale-force gusts from wind 50 or gusts 70', () => {
    expect(sceneAddition({ ...base, wind: 50 })).toBe('storm');
    expect(sceneAddition({ ...base, gust: 70, temp: -8, snowDepth: 0.2 })).toBe('storm');
    expect(sceneAddition({ ...base, gust: 69 })).toBe('windy');
  });
  it('windy from gusts 50 or wind 35', () => {
    expect(sceneAddition({ ...base, gust: 50 })).toBe('windy');
    expect(sceneAddition({ ...base, wind: 35 })).toBe('windy');
    expect(sceneAddition({ ...base, wind: 34, gust: 49 })).toBeUndefined();
  });
  it('snow on the ground from 1 cm, not beside a snow word', () => {
    expect(sceneAddition({ ...base, snowDepth: 0.01 })).toBe('snowLies');
    expect(sceneAddition({ ...base, snowDepth: 0.009 })).toBeUndefined();
    expect(sceneAddition({ ...base, id: 'snow', snowDepth: 0.3, temp: -3 })).toBeUndefined();
    expect(sceneAddition({ ...base, temp: -3, snowDepth: 0.05 })).toBe('snowLies');
  });
  it('frost at 0° and below, not beside a snow word', () => {
    expect(sceneAddition({ ...base, temp: 0 })).toBe('frost');
    expect(sceneAddition({ ...base, temp: -4, id: 'snowGrains' })).toBeUndefined();
    expect(sceneAddition({ ...base, temp: 1 })).toBeUndefined();
  });
  it('heat from 30° by day only', () => {
    expect(sceneAddition({ ...base, temp: 30 })).toBe('heat');
    expect(sceneAddition({ ...base, temp: 31, night: true })).toBeUndefined();
  });
});

/* ============================== package 1b: the picture's model ============================== */

/** CONCEPT §3: code → cond, intensity, day sky, night sky (cloud cover from the condition's default). */
const TABLE: [number, string, number, string, string][] = [
  [0, 'clear', 2, 'day', 'night'],
  [1, 'mostlyClear', 2, 'day', 'night'],
  [2, 'partly', 2, 'day', 'night'],
  [3, 'overcast', 2, 'overcast', 'night-overcast'],
  [45, 'fog', 2, 'fog', 'night-fog'],
  [48, 'fog', 2, 'fog', 'night-fog'],
  [51, 'drizzle', 1, 'drizzle', 'night-overcast'],
  [53, 'drizzle', 2, 'drizzle', 'night-overcast'],
  [55, 'drizzle', 3, 'drizzle', 'night-overcast'],
  [56, 'freezingDrizzle', 1, 'drizzle', 'night-overcast'],
  [57, 'freezingDrizzle', 3, 'drizzle', 'night-overcast'],
  [61, 'rain', 1, 'rain', 'night-rain'],
  [63, 'rain', 2, 'rain', 'night-rain'],
  [65, 'rain', 3, 'rain', 'night-rain'],
  [66, 'freezingRain', 1, 'rain', 'night-rain'],
  [67, 'freezingRain', 3, 'rain', 'night-rain'],
  [71, 'snow', 1, 'snow', 'night-snow'],
  [73, 'snow', 2, 'snow', 'night-snow'],
  [75, 'snow', 3, 'snow', 'night-snow'],
  [77, 'snow', 1, 'snow', 'night-snow'],
  [80, 'showers', 1, 'drizzle', 'night-rain'],
  [81, 'showers', 2, 'drizzle', 'night-rain'],
  [82, 'showers', 3, 'drizzle', 'night-rain'],
  [85, 'snowShowers', 1, 'snow', 'night-snow'],
  [86, 'snowShowers', 3, 'snow', 'night-snow'],
  [95, 'thunder', 2, 'storm', 'night-rain'],
  [96, 'thunderHail', 2, 'storm', 'night-rain'],
  [99, 'thunderHail', 3, 'storm', 'night-rain'],
];

const forecastAt = (
  time: string,
  over: Partial<Forecast> = {},
  now: Forecast['now'] = {},
): Forecast => ({
  temp: 10,
  group: 'clear',
  time,
  now: { night: false, ...now },
  days: [
    {
      date: time.slice(0, 10),
      min: 2,
      max: 12,
      group: 'clear',
      rain: 0,
      sunrise: '07:38',
      sunset: '16:24',
    },
  ],
  ...over,
});
const sceneAt = (
  time: string,
  over: Partial<Forecast> = {},
  now: Forecast['now'] = {},
  lat = 50,
): SceneState =>
  sceneOf({ forecast: forecastAt(time, over, now), at: 0, nowMs: 0, lat, theme: 'light' });

describe('scene model (CONCEPT §3)', () => {
  it('covers every Open-Meteo code', () => {
    expect(TABLE.map((r) => r[0])).toEqual([...WMO_CODES].sort((a, b) => a - b));
  });

  it.each(TABLE)(
    'code %i → %s %i, sky by day %s, by night %s',
    (code, cond, intensity, day, night) => {
      expect(condOf(code, codeGroup(code))).toEqual({ cond, intensity });
      const byDay = sceneAt('2026-11-24T12:00', { code, group: codeGroup(code) });
      expect(byDay.phase).toBe('day');
      expect(skyKey(byDay)).toBe(day);
      expect(byDay.body.kind).toBe('sun');
      const byNight = sceneAt(
        '2026-11-24T02:50',
        { code, group: codeGroup(code) },
        { night: true },
      );
      expect(byNight.phase).toBe('night');
      expect(skyKey(byNight)).toBe(night);
      // No moon before package 2: the night has no body.
      expect(byNight.body.kind).toBe('none');
      // Snow on the ground while it snows; rime fog is frost 1 even when mild.
      expect(byDay.snowGround).toBe(cond === 'snow' || cond === 'snowShowers');
      expect(byDay.frost).toBe(code === 48 ? 1 : 0);
    },
  );

  it('without a code: the group at intensity 2', () => {
    expect(condOf(undefined, 'cloudy')).toEqual({ cond: 'overcast', intensity: 2 });
    expect(condOf(undefined, 'snow')).toEqual({ cond: 'snow', intensity: 2 });
    expect(condOf(undefined, 'thunder')).toEqual({ cond: 'thunder', intensity: 2 });
    expect(sceneAt('2026-11-24T12:00', { group: 'rain' }).cond).toBe('rain');
  });

  it('a cover above 85 % turns an open sky into the overcast family', () => {
    expect(skyKey(sceneAt('2026-11-24T12:00', { code: 2 }, { cloud: 85 }))).toBe('day');
    expect(skyKey(sceneAt('2026-11-24T12:00', { code: 2 }, { cloud: 86 }))).toBe('overcast');
    expect(skyKey(sceneAt('2026-11-24T02:50', { code: 2 }, { night: true, cloud: 86 }))).toBe(
      'night-overcast',
    );
  });

  it('wind levels at and below their edges', () => {
    expect([windLevel(19, 34), windLevel(20, 0), windLevel(0, 35)]).toEqual([0, 1, 1]);
    expect([windLevel(34, 49), windLevel(35, 0), windLevel(0, 50)]).toEqual([1, 2, 2]);
    expect([windLevel(49, 69), windLevel(50, 0), windLevel(0, 70)]).toEqual([2, 3, 3]);
    expect(windLevel(undefined, undefined)).toBe(0);
  });

  it('frost at 0° (nothing falling) and −5°, heat at 30° by day, snow lying from 1 cm', () => {
    expect([frostLevel(0.1, 'clear'), frostLevel(0, 'clear'), frostLevel(0, 'snow')]).toEqual([
      0, 1, 0,
    ]);
    expect([frostLevel(-4.9, 'rain'), frostLevel(-5, 'rain'), frostLevel(-5, 'clear')]).toEqual([
      0, 2, 2,
    ]);
    expect(sceneAt('2026-11-24T12:00', { temp: 29 }).heat).toBe(false);
    expect(sceneAt('2026-11-24T12:00', { temp: 30 }).heat).toBe(true);
    expect(sceneAt('2026-11-24T02:50', { temp: 30 }, { night: true }).heat).toBe(false);
    expect(sceneAt('2026-11-24T12:00', {}, { snowDepth: 0.009 }).snowGround).toBe(false);
    expect(sceneAt('2026-11-24T12:00', {}, { snowDepth: 0.01 }).snowGround).toBe(true);
  });

  it.each([
    // sunrise 07:38, sunset 16:24: dawn from 06:58, golden to 08:23 and from 15:24, dusk to 17:04
    ['06:57', 'night'],
    ['06:58', 'dawn'],
    ['07:37', 'dawn'],
    ['07:38', 'golden'],
    ['08:22', 'golden'],
    ['08:23', 'day'],
    ['15:23', 'day'],
    ['15:24', 'golden'],
    ['16:23', 'golden'],
    ['16:24', 'dusk'],
    ['17:03', 'dusk'],
    ['17:04', 'night'],
  ])('at %s the phase is %s', (hhmm, phase) => {
    expect(phaseOf(`2026-11-24T${hhmm}`, '07:38', '16:24', true)).toBe(phase);
  });

  it('without sunrise and sunset (polar day or night) is_day decides', () => {
    expect(phaseOf('2026-06-21T02:00', undefined, undefined, true)).toBe('day');
    expect(phaseOf('2026-12-21T12:00', undefined, undefined, false)).toBe('night');
  });

  it('the sun on its arc: t from sunrise to sunset; none in twilight', () => {
    expect(sceneAt('2026-11-24T12:01').body).toEqual({ kind: 'sun', t: 0.5 });
    expect(sceneAt('2026-11-24T07:38').body.t).toBe(0);
    expect(sceneAt('2026-11-24T07:10').body.kind).toBe('none');
    expect(sceneAt('2026-11-24T16:40').body.kind).toBe('none');
  });

  it.each([
    [1, 50, 'winter'],
    [3, 50, 'spring'],
    [5, 50, 'spring'],
    [6, 50, 'summer'],
    [8, 50, 'summer'],
    [9, 50, 'autumn'],
    [11, 50, 'autumn'],
    [12, 50, 'winter'],
    [1, -34, 'summer'],
    [4, -34, 'autumn'],
    [7, -34, 'winter'],
    [10, -34, 'spring'],
    [7, 10, 'summer'],
    [1, -23, 'summer'],
  ] as const)('month %i at latitude %i is %s', (month, lat, season) => {
    expect(seasonOf(month, lat)).toBe(season);
  });
});

/* ============================== package 2: the moon in the scene ============================== */
describe('the moon in the scene (CONCEPT-MOON §4, §5)', () => {
  const moon = (o: Partial<MoonInput> = {}): MoonInput => ({
    lit: 0.6,
    tilt: -60,
    alt: 30,
    az: 200,
    full: false,
    superMoon: false,
    ...o,
  });
  const at = (time: string, m?: MoonInput, now: Forecast['now'] = { night: true }, lat = 50) =>
    sceneOf({ forecast: forecastAt(time, {}, now), at: 0, nowMs: 0, lat, theme: 'light', moon: m });

  it('drawn at night, dawn and dusk while up; none below the horizon or when switched off', () => {
    expect(at('2026-11-24T02:50', moon()).body).toMatchObject({ kind: 'moon', alt: 30 });
    expect(at('2026-11-24T07:10', moon()).body.kind).toBe('moon'); // dawn
    expect(at('2026-11-24T16:40', moon()).body.kind).toBe('moon'); // dusk
    expect(at('2026-11-24T02:50', moon({ alt: -0.5 })).body.kind).toBe('none');
    expect(at('2026-11-24T02:50', undefined).body.kind).toBe('none');
    expect(at('2026-11-24T12:00', moon(), { night: false }).body.kind).toBe('sun');
  });

  it('on the arc: east left, south top, west right; mirrored south of the equator', () => {
    expect([moonArcT(90, 50), moonArcT(180, 50), moonArcT(270, 50)]).toEqual([0, 0.5, 1]);
    expect([moonArcT(90, -34), moonArcT(0, -34), moonArcT(270, -34)]).toEqual([1, 0.5, 0]);
    // rising east-south-east and setting west-south-west in Sydney: the ends, not the west end for both
    expect([moonArcT(100, -34), moonArcT(80, -34), moonArcT(300, -34), moonArcT(260, -34)]).toEqual(
      [1, (80 + 90) / 180, (-60 + 90) / 180, 0],
    );
    expect(moonArcT(30, 50)).toBe(0);
  });

  it('full moon 1.2 × with its own sky, supermoon 1.35 ×; stars thin out', () => {
    const full = at('2026-11-24T02:50', moon({ lit: 0.99, full: true }));
    expect(full.moon?.size).toBe(1.2);
    expect(skyKey(full)).toBe('night-full');
    expect(at('2026-11-24T02:50', moon({ lit: 1, full: true, superMoon: true })).moon?.size).toBe(
      1.35,
    );
    expect(skyKey(at('2026-11-24T02:50', moon({ lit: 0.99, full: true, alt: -3 })))).toBe('night');
    expect(at('2026-11-24T02:50', moon()).moon?.size).toBe(1);
  });

  it('day moon: by day, up, 20–97 % lit, cloud ≤ 60 %', () => {
    const day = (m: MoonInput, cloud = 20) =>
      at('2026-11-24T12:00', m, { night: false, cloud }).dayMoon;
    expect(day(moon({ lit: 0.2 }))).toBe(true);
    expect(day(moon({ lit: 0.19 }))).toBe(false);
    expect(day(moon({ lit: 0.98 }))).toBe(false);
    expect(day(moon({ alt: -1 }))).toBe(false);
    expect(day(moon(), 61)).toBe(false);
    expect(day(moon(), 60)).toBe(true);
  });
});

/* ============================== package 3: sky events in the scene ============================== */
describe('sky events in the scene (handoff 03 "Scene", CONCEPT-EVENTS §1)', () => {
  const moonUp: MoonInput = {
    lit: 1,
    tilt: -60,
    alt: 30,
    az: 200,
    full: true,
    superMoon: false,
  };
  const DAY = '2026-11-24T12:00';
  const NIGHT = '2026-11-24T02:50';
  const at = (
    time: string,
    event: SceneEvent,
    amount = 1,
    o: { night?: boolean; cloud?: number; moon?: MoonInput; code?: number } = {},
  ): SceneState =>
    sceneOf({
      forecast: forecastAt(time, o.code != null ? { code: o.code, group: codeGroup(o.code) } : {}, {
        night: o.night ?? time === NIGHT,
        cloud: o.cloud ?? 5,
      }),
      at: 0,
      nowMs: 0,
      lat: 50,
      theme: 'light',
      moon: o.moon,
      event: { event, amount },
    });

  it('without an event: none, amount 0', () => {
    const s = sceneAt(DAY);
    expect(s.event).toBeUndefined();
    expect(s.eventAmount).toBe(0);
  });

  it('solar events with the sun as the body: the amount is kept; total has its own sky', () => {
    const partial = at(DAY, 'solarPartial', 0.42);
    expect(partial).toMatchObject({ event: 'solarPartial', eventAmount: 0.42 });
    expect(partial.body.kind).toBe('sun');
    expect(skyKey(partial)).toBe('day');
    expect(at(DAY, 'solarAnnular', 0.9)).toMatchObject({ event: 'solarAnnular', eventAmount: 0.9 });
    const total = at(DAY, 'solarTotal', 1);
    expect(total.event).toBe('solarTotal');
    expect(skyKey(total)).toBe('eclipse-sky');
    expect(at(DAY, 'solarPartial', 1.7).eventAmount).toBe(1);
    // no sun, no solar event
    expect(at(NIGHT, 'solarTotal').event).toBeUndefined();
    expect(at('2026-11-24T07:10', 'solarPartial', 0.5).event).toBeUndefined(); // dawn
  });

  it('lunar events only with the moon as the body', () => {
    const total = at(NIGHT, 'lunarTotal', 1, { moon: moonUp });
    expect(total).toMatchObject({ event: 'lunarTotal', eventAmount: 1 });
    expect(total.body.kind).toBe('moon');
    expect(at(NIGHT, 'lunarPartial', 0.3, { moon: moonUp })).toMatchObject({
      event: 'lunarPartial',
      eventAmount: 0.3,
    });
    expect(at(NIGHT, 'lunarPartial', 0.3, { moon: { ...moonUp, alt: -2 } }).event).toBeUndefined();
    expect(at(NIGHT, 'lunarTotal').event).toBeUndefined(); // no moon input
  });

  it('rainbow: no sun disc; only while the sun is up', () => {
    const s = at(DAY, 'rainbow', 1, { code: 61, cloud: 70 });
    expect(s.event).toBe('rainbow');
    expect(s.body.kind).toBe('none');
    expect(at(NIGHT, 'rainbow', 1, { code: 61 }).event).toBeUndefined();
  });

  it('dust: by day with its own sky, ignored at night', () => {
    const s = at(DAY, 'dust');
    expect(s).toMatchObject({ event: 'dust', eventAmount: 1 });
    expect(skyKey(s)).toBe('dust');
    expect(at(NIGHT, 'dust').event).toBeUndefined();
    expect(skyKey(at(NIGHT, 'dust'))).toBe('night');
  });

  it('meteors at night up to 60 % cloud; the star night at night', () => {
    expect(at(NIGHT, 'meteors', 1, { cloud: 60 }).event).toBe('meteors');
    expect(at(NIGHT, 'meteors', 1, { cloud: 61 }).event).toBeUndefined();
    expect(at(DAY, 'meteors').event).toBeUndefined();
    expect(at(NIGHT, 'starNight').event).toBe('starNight');
    expect(at(DAY, 'starNight').event).toBeUndefined();
  });

  it('aurora (package 3b): at night up to 60 % cloud, never by day or in twilight; amount clamped', () => {
    for (const amount of [0.4, 0.7, 1]) {
      const s = at(NIGHT, 'aurora', amount, { cloud: 60 });
      expect(s).toMatchObject({ phase: 'night', event: 'aurora', eventAmount: amount });
      // the curtains sit in the plain night sky: same key, same (light) ink
      expect(skyKey(s)).toBe('night');
      expect(inkOf(s)).toBe('light');
    }
    expect(at(NIGHT, 'aurora', 1, { cloud: 61 }).event).toBeUndefined();
    expect(at(NIGHT, 'aurora', 1, { cloud: 95, code: 3 }).event).toBeUndefined();
    expect(at(DAY, 'aurora').event).toBeUndefined();
    const dawn = at('2026-11-24T07:10', 'aurora', 1);
    expect(dawn.phase).toBe('dawn');
    expect(dawn.event).toBeUndefined();
    expect(at(NIGHT, 'aurora', 1.6).eventAmount).toBe(1);
    expect(at(NIGHT, 'aurora', -0.2)).toMatchObject({ event: 'aurora', eventAmount: 0 });
    expect(at(DAY, 'aurora', 0.7).eventAmount).toBe(0);
  });

  it('the two event skies are listed and take their ink (palette.js inkOf)', () => {
    expect(SKY_KEYS).toEqual(expect.arrayContaining(['dust', 'eclipse-sky']));
    expect([inkForSky('dust', 'light'), inkForSky('dust', 'dark')]).toEqual(['dark', 'light']);
    expect([inkForSky('eclipse-sky', 'light'), inkForSky('eclipse-sky', 'dark')]).toEqual([
      'light',
      'light',
    ]);
  });
});
