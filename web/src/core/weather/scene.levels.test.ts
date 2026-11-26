import { describe, expect, it } from 'vitest';
import { tWeather } from '@/strings.weather';
import type { Forecast } from './api';
import {
  bodyMode,
  conditionId,
  coverOf,
  fogLevel,
  intensityOfAmount,
  sceneOf,
  skyKey,
  snowCoverOf,
  sunLevel,
  thunderLevel,
  veilOf,
  wetOf,
  windTo,
  type SceneHour,
} from './scene';

/**
 * Round 2, package A (docs/design/weather-scenes-2/CONCEPT §2–§3, handoff 00 "Scene state"): every level as a table
 * data → level, each limit once on each side; then the state the drawing reads (`sceneOf` with an hour row).
 */
describe('cloud level (CONCEPT §3 "Cloud")', () => {
  it.each([
    [{ cloud: 10 }, 0],
    [{ cloud: 11 }, 1],
    [{ cloud: 35 }, 1],
    [{ cloud: 36 }, 2],
    [{ cloud: 60 }, 2],
    [{ cloud: 61 }, 3],
    [{ cloud: 85 }, 3],
    [{ cloud: 86 }, 4],
    // the three heights known: the larger of low and middle, high cloud alone is never a deck
    [{ cloud: 100, cloudLow: 5, cloudMid: 10, cloudHigh: 100 }, 0],
    [{ cloud: 100, cloudLow: 40, cloudMid: 10, cloudHigh: 100 }, 2],
    [{ cloud: 20, cloudLow: 90, cloudMid: 0, cloudHigh: 0 }, 4],
    // only two heights: the total cover
    [{ cloud: 50, cloudLow: 0, cloudMid: 0 }, 2],
  ] as [SceneHour, number][])('%o → %i', (h, level) => {
    expect(coverOf(h)).toBe(level);
  });

  it('without any value: the condition default, and the deck without one', () => {
    expect(coverOf({}, 25)).toBe(1);
    expect(coverOf({})).toBe(4);
  });
});

describe('veil (CONCEPT §2)', () => {
  it.each([
    [{ cloudHigh: 50, cloudLow: 30, cloudMid: 30 }, true],
    [{ cloudHigh: 49, cloudLow: 0, cloudMid: 0 }, false],
    [{ cloudHigh: 80, cloudLow: 31, cloudMid: 0 }, false],
    [{ cloudHigh: 80, cloudLow: 0, cloudMid: 31 }, false],
    [{ cloudHigh: 80, cloudLow: 0 }, false], // without all three heights there is no veil
  ] as [SceneHour, boolean][])('%o → %s', (h, veil) => {
    expect(veilOf(h)).toBe(veil);
  });
});

describe('how sunny (CONCEPT §3)', () => {
  it.each([
    [45, 2, 3],
    [44, 0, 2],
    [20, 0, 2],
    [19, 0, 1],
    [5, 0, 1],
    [4, 0, 0],
    [60, 4, 0], // under a deck no rays, whatever the field says
  ] as const)('sunshine %i min, cover %i → %i', (sunMin, cover, level) => {
    expect(sunLevel({ sunMin }, cover)).toBe(level);
  });
  it.each([
    [0, 3],
    [1, 3],
    [2, 2],
    [3, 1],
    [4, 0],
  ] as const)('without the field: cover %i → %i', (cover, level) => {
    expect(sunLevel({}, cover)).toBe(level);
  });
});

describe('rain and snow strength without a code (CONCEPT §3)', () => {
  it.each([
    [2.4, 1],
    [2.5, 2],
    [7.4, 2],
    [7.5, 3],
  ] as const)('%f mm → %i', (mm, level) => {
    expect(intensityOfAmount(mm)).toBe(level);
  });
});

describe('thunder level (CONCEPT §3)', () => {
  it.each([
    [80, 0, 0, 0, 0],
    [95, 2.4, 49, 799, 1],
    [95, 2.5, 0, 0, 2],
    [95, 0, 50, 0, 2],
    [95, 0, 0, 800, 2],
    [95, 0, 0, undefined, 1], // unknown CAPE counts as low
    [95, undefined, 0, 0, 2], // an unknown amount never makes a storm light
    [95, 9.9, 69, 1999, 2],
    [95, 10, 0, 0, 3],
    [95, 0, 70, 0, 3],
    [95, 0, 0, 2000, 3],
    [96, 0, 0, 0, 2], // hail is at least level 2
    [96, 10, 0, 0, 3],
    [99, 0, 0, 0, 3],
  ] as const)('code %i, %s mm, gusts %s, CAPE %s → %i', (code, mm, gust, cape, level) => {
    expect(thunderLevel(code, mm, gust, cape)).toBe(level);
  });
});

describe('fog level (CONCEPT §3)', () => {
  it.each([
    [3, 100, 0],
    [45, undefined, 1],
    [45, 300, 1],
    [45, 299, 2],
    [48, 120, 2],
  ] as const)('code %i, visibility %s → %i', (code, vis, level) => {
    expect(fogLevel(code, vis)).toBe(level);
  });
});

describe('snow cover (CONCEPT §3)', () => {
  it.each([
    [0.009, 0, 0],
    [0.01, 0, 1],
    [0.049, 0, 1],
    [0.05, 0, 2],
    [0.199, 0, 2],
    [0.2, 0, 3],
    [undefined, 1, 0],
    [undefined, 2, 1], // it snows at level ≥ 2: at least dusted
    [0.3, 3, 3],
  ] as const)('%s m, snowing at %i → %i', (depth, snowing, level) => {
    expect(snowCoverOf(depth, snowing)).toBe(level);
  });
});

describe('wind direction in the picture (CONCEPT §3 "direction")', () => {
  it.each([
    [270, 47, 'left'], // a westerly in the north blows to the left
    [180, 47, 'left'],
    [179, 47, 'right'],
    [0, 47, 'right'],
    [90, 47, 'right'],
    [359, 47, 'left'],
    [270, -33, 'right'], // south: mirrored
    [90, -33, 'left'],
    [undefined, 47, 'right'],
  ] as const)('from %s° at latitude %i → %s', (dir, lat, to) => {
    expect(windTo(dir, lat)).toBe(to);
  });
});

describe('wet (CONCEPT §3)', () => {
  it.each([
    [true, undefined, true],
    [false, { mm: 0.2 }, true],
    [false, { mm: 0.19 }, false],
    [false, undefined, false],
  ] as const)('raining %s, hour before %o → %s', (now, prev, wet) => {
    expect(wetOf(now, prev)).toBe(wet);
  });
});

describe('how the body is seen (CONCEPT §2)', () => {
  const b = {
    body: { kind: 'sun' },
    cover: 0,
    veil: false,
    thunder: 0,
    fog: 0,
    falling: false,
  } as const;
  it.each([
    [{}, 'clear'],
    [{ cover: 3 }, 'clear'],
    [{ veil: true, cover: 1 }, 'veil'],
    [{ cover: 4 }, 'hole'],
    [{ cover: 4, falling: true }, 'schein'],
    [{ cover: 4, fog: 1 }, 'schein'],
    [{ fog: 2 }, 'schein'],
    [{ thunder: 2, cover: 4 }, 'schein'],
    [{ thunder: 1, cover: 3, falling: true }, 'clear'],
    [{ cover: 4, level: 'plain' }, 'schein'], // "Schlicht" under a deck: pale
    [{ body: { kind: 'none' }, cover: 4 }, ''],
  ] as const)('%o → %s', (over, mode) => {
    expect(bodyMode({ ...b, ...over })).toBe(mode);
  });
});

describe('the words say the level (COPY §1)', () => {
  it.each([
    [95, { mm: 1, gust: 20 }, 'thunderLight', 'leichtes Gewitter', 'light thunderstorm'],
    [95, {}, 'thunder', 'Gewitter', 'thunderstorm'],
    [95, { mm: 12 }, 'thunderSevere', 'starkes Gewitter', 'severe thunderstorm'],
    [96, { mm: 1 }, 'thunderHail', 'Gewitter mit Hagel', 'thunderstorm with hail'],
    [
      96,
      { gust: 80 },
      'thunderHailSevere',
      'starkes Gewitter mit Hagel',
      'severe thunderstorm with hail',
    ],
    [45, { vis: 800 }, 'fog', 'Nebel', 'fog'],
    [45, { vis: 200 }, 'fogDense', 'dichter Nebel', 'dense fog'],
    [48, { vis: 200 }, 'rimeFogDense', 'dichter Nebel mit Reif', 'dense fog with rime'],
    [2, { cloudLow: 0, cloudMid: 10, cloudHigh: 70 }, 'veil', 'Schleierwolken', 'thin high cloud'],
    [0, { cloudLow: 0, cloudMid: 0, cloudHigh: 70 }, 'clear', 'klar', 'clear'], // WMO 0 stays "klar"
  ] as const)('code %i with %o → %s', (code, data, id, de, en) => {
    const got = conditionId(code, 'clear', data);
    expect(got).toBe(id);
    expect(tWeather.de.conditions[got]).toBe(de);
    expect(tWeather.en.conditions[got]).toBe(en);
  });
});

/* ---- the state (handoff 00 "Scene state", handoff A "Edge cases") ---- */
const forecast = (over: Partial<Forecast> = {}, now: Forecast['now'] = {}): Forecast => ({
  temp: 10,
  group: 'clear',
  time: '2026-11-26T12:00',
  now: { night: false, ...now },
  days: [
    {
      date: '2026-11-26',
      min: 2,
      max: 12,
      group: 'clear',
      rain: 0,
      sunrise: '07:40',
      sunset: '16:22',
    },
  ],
  ...over,
});
const scene = (f: Forecast, hour?: SceneHour, lat = 47) =>
  sceneOf({ forecast: f, hour, at: 0, nowMs: 0, lat, theme: 'light' });

describe('sceneOf, round 2', () => {
  it('a cache without the new fields: cover from the cover, sun from cover, thunder 2, fog 1', () => {
    const t = scene(forecast({ code: 95, group: 'thunder' }));
    expect([t.thunder, t.cover, t.mode, t.intensity]).toEqual([2, 4, 'schein', 2]);
    const fog = scene(forecast({ code: 45, group: 'fog' }, { cloud: 100 }));
    expect([fog.fog, fog.cover, fog.mode, fog.sun]).toEqual([1, 4, 'schein', 0]);
    const clear = scene(forecast({ code: 1 }, { cloud: 20 }));
    expect([clear.cover, clear.sun, clear.mode, clear.veil]).toEqual([1, 3, 'clear', false]);
  });

  it('reads the hour row of now for the amount, CAPE and the hour before', () => {
    const f = forecast(
      {
        code: 95,
        group: 'thunder',
        hours: [
          { time: '2026-11-26T11:00', temp: 9, group: 'rain', rain: 80, mm: 0.4 },
          { time: '2026-11-26T12:00', temp: 10, group: 'thunder', rain: 80, mm: 1.2 },
        ],
      },
      { gust: 30 },
    );
    const s = scene(f);
    expect([s.thunder, s.cover, s.intensity, s.wet]).toEqual([1, 3, 1, true]);
    expect(skyKey(s)).toBe('rain');
  });

  it('a chosen hour row wins over now', () => {
    const s = scene(forecast({ code: 0 }), {
      time: '2026-11-26T14:00',
      temp: -6,
      code: 73,
      group: 'snow',
      wind: 40,
      dir: 270,
      snowDepth: 0.06,
    });
    expect([s.cond, s.intensity, s.snowCover, s.frost, s.wind, s.windTo]).toEqual([
      'snow',
      2,
      2,
      2,
      2,
      'left',
    ]);
    expect(scene(forecast(), { time: '2026-11-26T14:00', code: 0, dir: 270 }, -33).windTo).toBe(
      'right',
    );
  });

  it('thunder 1 keeps sky around its tower, from 2 the base spans the sky', () => {
    const light = scene(forecast({ code: 95 }, { cloud: 100 }), {
      time: '2026-11-26T12:00',
      code: 95,
      mm: 1,
      cloud: 100,
    });
    expect([light.thunder, light.cover, light.mode]).toEqual([1, 3, 'clear']);
    const hard = scene(forecast(), { time: '2026-11-26T12:00', code: 99, cloud: 30 });
    expect([hard.thunder, hard.cover, hard.intensity]).toEqual([3, 4, 3]);
    expect(skyKey(hard)).toBe('storm');
  });

  it('veil only with the three heights; no sun rays while something falls', () => {
    const v = scene(forecast(), {
      time: '2026-11-26T12:00',
      code: 2,
      cloud: 70,
      cloudLow: 0,
      cloudMid: 5,
      cloudHigh: 90,
      sunMin: 50,
    });
    expect([v.veil, v.cover, v.mode, v.sun]).toEqual([true, 0, 'veil', 3]);
    const r = scene(forecast(), { time: '2026-11-26T12:00', code: 63, cloud: 100 });
    expect([r.sun, r.mode, r.wet]).toEqual([0, 'schein', true]);
  });
});
