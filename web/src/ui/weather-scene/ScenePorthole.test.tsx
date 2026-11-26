// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Forecast } from '@/core/weather/api';
import { defaultScene, sceneOf, type SceneHour, type SceneState } from '@/core/weather/scene';
import { countElements, PORTHOLE, portholeSvg } from './draw';
import { ScenePorthole } from './ScenePorthole';

afterEach(cleanup);

const parse = (s: SceneState, px = 64): Document =>
  new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${portholeSvg(s, px).inner}</svg>`,
    'image/svg+xml',
  );
const layers = (s: SceneState, px = 64): string[] =>
  [...parse(s, px).querySelectorAll('[data-layer]')].map((g) => g.getAttribute('data-layer')!);
const parts = (s: SceneState, px = 64): string[] =>
  [...parse(s, px).querySelectorAll('[data-part]')].map((g) => g.getAttribute('data-part')!);

const forecast = (night: boolean, time: string): Forecast => ({
  temp: 12,
  group: 'clear',
  time,
  now: { night },
  days: [
    {
      date: time.slice(0, 10),
      min: 8,
      max: 20,
      group: 'clear',
      rain: 0,
      sunrise: '05:20',
      sunset: '21:30',
    },
  ],
});
const MOON = { lit: 0.6, tilt: 30, alt: 35, az: 170, full: false, superMoon: false };
/** A state the model produces for an hour (the same `sceneOf` as the head and `useSmallScene`). */
function stateOf(time: string, h: SceneHour, theme: 'light' | 'dark' = 'light'): SceneState {
  const night = !!h.night;
  return sceneOf({
    forecast: forecast(night, `2026-01-15T${time}`),
    hour: { temp: 12, ...h, time: `2026-01-15T${time}` },
    at: 0,
    nowMs: 0,
    lat: 47,
    theme,
    motion: true,
    moon: night ? MOON : undefined,
  });
}

/** One hour per sky (the round's measure list) and the heavy cases; the mode each must come out in. */
const SKIES: [string, string, SceneHour][] = [
  ['clear day', '12:00', { code: 0, cloud: 5 }],
  ['a few clouds', '12:00', { code: 1, cloud: 25 }],
  ['broken cover', '12:00', { code: 2, cloud: 80 }],
  ['golden hour', '20:50', { code: 0 }],
  ['dawn', '05:00', { code: 0, night: true }],
  ['overcast', '12:00', { code: 3, cloud: 95 }],
  ['drizzle', '12:00', { code: 53, cloud: 100 }],
  ['rain', '12:00', { code: 63, cloud: 100 }],
  ['showers', '12:00', { code: 81, cloud: 70 }],
  ['thunder', '12:00', { code: 95, mm: 4 }],
  ['thunder with hail, wind 3', '12:00', { code: 99, wind: 60, mm: 12 }],
  ['snow 3, wind 3', '12:00', { code: 75, wind: 60, snowDepth: 0.3, temp: -3 }],
  ['fog 1', '12:00', { code: 45, vis: 800 }],
  ['fog 2', '12:00', { code: 45, vis: 200 }],
  ['clear night', '01:00', { code: 0, night: true }],
  ['overcast night', '01:00', { code: 3, cloud: 95, night: true }],
  ['rainy night', '01:00', { code: 63, cloud: 100, night: true }],
  ['snowy night', '01:00', { code: 73, cloud: 100, night: true, temp: -2 }],
];
/** Layers of the foreground and the other mountains: never in the porthole. */
const NEVER = ['ridgeFar', 'ridgeMid', 'water', 'ridgeNear', 'wind', 'cloudsFar'];

describe('porthole on the new drawing (round 2, CONCEPT §6, handoff D)', () => {
  it.each(SKIES)(
    '%s: sky, body in its mode, the main summit, one bank or cloud, a few marks',
    (_, time, h) => {
      for (const theme of ['light', 'dark'] as const) {
        const s = stateOf(time, h, theme);
        const svg = portholeSvg(s, 64);
        expect(svg.viewBox).toBe(PORTHOLE.view.join(' '));
        const got = layers(s);
        expect(got[0]).toBe('sky');
        for (const l of NEVER) expect(got, l).not.toContain(l);
        // the body whenever it is up, in every sky (CONCEPT §0 sentence 9), in the head's mode
        expect(got.includes('body')).toBe(s.body.kind !== 'none');
        if (s.body.kind !== 'none')
          expect(parse(s).querySelector('[data-layer="body"]')!.getAttribute('data-mode')).toBe(
            s.mode,
          );
        // the main summit alone, with its shaded face
        const p = parts(s);
        if (s.fog < 2) {
          expect(p).toContain('main');
          expect(p).toContain('shade');
        }
        for (const other of ['outlier', 'edge', 'shoulder', 'west', 'east', 'back'])
          expect(p).not.toContain(other);
        // one deck bank or one cloud by cover
        const clouds = parse(s).querySelectorAll('[data-layer="clouds"]');
        if (s.cover === 0 && !s.thunder) expect(clouds).toHaveLength(0);
        else {
          const decks = parse(s).querySelectorAll('[data-part="deck"]').length;
          const banks = parse(s).querySelectorAll('[data-bank]').length;
          const cumuli = parse(s).querySelectorAll('[data-layer="clouds"] > g').length;
          if (s.cover === 4 || s.thunder) {
            expect(decks).toBe(1);
            expect(banks).toBeLessThanOrEqual(1);
            expect(cumuli).toBe(0);
          } else expect([decks, banks, cumuli]).toEqual([0, 0, 1]);
        }
        // a few marks of rain or snow, in one path
        const precip = parse(s).querySelectorAll(
          '[data-layer="precip"] path:not([data-part="hail"])',
        );
        if (/rain|rizzle|howers|thunder|snow/i.test(s.cond)) {
          expect(precip).toHaveLength(1);
          const marks = (precip[0]!.getAttribute('d')!.match(/m/gi) ?? []).length;
          expect(marks).toBeGreaterThanOrEqual(5);
          expect(marks).toBeLessThanOrEqual(10);
        } else expect(precip).toHaveLength(0);
        // never moves, even when the head's state asks for motion
        expect(s.motion).toBe(true);
        expect(svg.inner).not.toMatch(/sc-[a-z]+|data-motion|<animate|<use/);
        // small: a fraction of the head's ceiling (A11Y §4)
        expect(countElements(svg.inner)).toBeLessThanOrEqual(48);
        expect(svg.inner.length + JSON.stringify(svg.vars).length).toBeLessThanOrEqual(12 * 1024);
        // colours are tokens, never literals
        expect(svg.inner).not.toMatch(/#[0-9a-fA-F]{3,6}\b(?!\))/);
      }
    },
  );

  it('every mode: clear with rays, the veil ring, the hole with its one bank, the pale schein', () => {
    const clear = stateOf('12:00', { code: 0, cloud: 5 });
    expect(clear.mode).toBe('clear');
    expect(parts(clear)).toContain('rays');
    const veil: SceneState = { ...clear, veil: true, mode: 'veil' };
    expect(parse(veil).querySelector('[data-layer="body"] path[stroke]')).not.toBeNull();
    const hole: SceneState = { ...stateOf('12:00', { code: 3, cloud: 95 }), mode: 'hole' };
    expect(parts(hole)).toEqual(expect.arrayContaining(['opening', 'spill', 'rim']));
    expect(parse(hole).querySelectorAll('[data-bank]')).toHaveLength(1);
    const schein = stateOf('12:00', { code: 63, cloud: 100 });
    expect(schein.mode).toBe('schein');
    expect(parts(schein)).toContain('schein');
    expect(parts(schein)).not.toContain('rays');
  });

  it('thunder: the main bolt; hail: its stones; snow: flakes, rain: strokes', () => {
    expect(parts(stateOf('12:00', { code: 95, mm: 4 }))).toContain('bolt');
    expect(parts(stateOf('12:00', { code: 99, wind: 60, mm: 12 }))).toContain('hail');
    expect(parts(stateOf('12:00', { code: 95, mm: 4 }))).not.toContain('hail');
    expect(parts(stateOf('12:00', { code: 75, temp: -3 }))).toContain('flakes');
    expect(parts(stateOf('12:00', { code: 63, cloud: 100 }))).toContain('rain');
  });

  it('the moon shows its true phase, turned to its tilt, at the body size of the porthole', () => {
    const s = stateOf('01:00', { code: 0, night: true });
    expect(s.body.kind).toBe('moon');
    expect(parse(s).querySelector('[data-part="moon"]')!.getAttribute('transform')).toMatch(
      /^rotate\(/,
    );
    expect(parse(s).querySelector('[data-layer="body"]')!.getAttribute('transform')).toContain(
      `scale(${PORTHOLE.bodyK})`,
    );
  });

  it('no sky event in the small versions (CONCEPT §6, open)', () => {
    const night = stateOf('01:00', { code: 0, night: true });
    for (const event of ['aurora', 'meteors', 'starNight', 'lunarTotal'] as const) {
      const p = parts({ ...night, event, eventAmount: 1 });
      for (const e of ['aurora', 'auroraGlow', 'meteors', 'milky', 'copper'])
        expect(p, event).not.toContain(e);
    }
  });

  it('"Schlicht" keeps sky and body only', () => {
    for (const [, time, h] of SKIES) {
      const got = layers({ ...stateOf(time, h), level: 'plain' });
      expect(got.every((l) => l === 'sky' || l === 'stars' || l === 'body')).toBe(true);
      expect(got).toContain('sky');
    }
  });

  it('"Mond und Himmelsereignisse" off (no moon in the state): no moon in the porthole', () => {
    const s: SceneState = {
      ...stateOf('01:00', { code: 0, night: true }),
      body: { kind: 'none', t: 0.5 },
      moon: undefined,
    };
    expect(layers(s)).not.toContain('body');
    expect(parse(s).querySelector('[data-part="moon"]')).toBeNull();
  });

  it('two portholes on one page keep their own ids; colours are declared once as custom properties', () => {
    const s = stateOf('12:00', { code: 2, cloud: 50 });
    const a = portholeSvg(s, 28, 'a');
    const b = portholeSvg(s, 28, 'b');
    const ids = (x: string) => [...x.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(a.inner).some((id) => ids(b.inner).includes(id))).toBe(false);
    expect(Object.values(a.vars).length).toBeGreaterThan(0);
  });

  it('the component: hidden from assistive tech, 28 / 64 px, no motion attribute, grey in "Ruhig"', () => {
    const s: SceneState = {
      ...defaultScene('light', 7),
      ...stateOf('12:00', { code: 63, cloud: 100 }),
    };
    const { rerender } = render(<ScenePorthole state={s} size={28} />);
    const p = screen.getByTestId('scene-porthole');
    expect(p).toHaveAttribute('aria-hidden', 'true');
    const svg = p.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '28');
    expect(svg).toHaveAttribute('data-cond', 'rain');
    expect(svg).not.toHaveAttribute('data-motion');
    expect(p.querySelector('[class*="sc-"]')).toBeNull();
    expect(p.querySelector('[data-layer="precip"]')).not.toBeNull();
    expect(p.className).not.toMatch(/calm/);
    rerender(<ScenePorthole state={{ ...s, calm: true }} size={64} />);
    expect(screen.getByTestId('scene-porthole').className).toMatch(/calm/);
    expect(screen.getByTestId('scene-porthole').querySelector('svg')).toHaveAttribute(
      'width',
      '64',
    );
    // the calm porthole takes the theme's ink, like the calm head
    expect(screen.getByTestId('scene-porthole').querySelector('svg')).toHaveAttribute(
      'data-ink',
      'dark',
    );
  });
});
