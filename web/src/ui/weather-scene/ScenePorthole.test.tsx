// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultScene, type SceneState } from '@/core/weather/scene';
import { portholeSvg } from './draw';
import { ScenePorthole } from './ScenePorthole';

afterEach(cleanup);

const base = (o: Partial<SceneState> = {}): SceneState => ({ ...defaultScene('light', 7), ...o });
const parse = (s: SceneState, px = 64): Document =>
  new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${portholeSvg(s, px).inner}</svg>`,
    'image/svg+xml',
  );
const layers = (s: SceneState, px = 64): string[] =>
  [...parse(s, px).querySelectorAll('[data-layer]')].map((g) => g.getAttribute('data-layer')!);

const sun = { kind: 'sun', t: 0.5 } as const;
const moonUp = {
  body: { kind: 'moon', t: 0.6, alt: 30 },
  moon: { illum: 0.6, tilt: -100, size: 1, t: 0.6, alt: 30 },
} as const;

/** The twelve states of mockups/06-klein.html "Bullauge" and the layers each must show (handoff 04 "Tests"). */
const STATES: [string, Partial<SceneState>, string[]][] = [
  ['clear', { cond: 'clear', cloud: 5, body: sun }, ['sky', 'body', 'ridgeFar', 'ridgeNear']],
  [
    'partly',
    { cond: 'partly', cloud: 50, body: sun },
    ['sky', 'body', 'clouds', 'ridgeFar', 'ridgeNear'],
  ],
  ['overcast', { cond: 'overcast', cloud: 95, body: sun }, ['sky', 'body', 'clouds', 'ridgeNear']],
  ['fog', { cond: 'fog', cloud: 95, body: sun }, ['sky', 'body', 'fog']],
  ['drizzle', { cond: 'drizzle', cloud: 95 }, ['sky', 'clouds', 'precip']],
  ['rain', { cond: 'rain', intensity: 2, cloud: 95, body: sun }, ['sky', 'clouds', 'precip']],
  ['showers', { cond: 'showers', cloud: 60, body: sun }, ['sky', 'body', 'clouds', 'precip']],
  ['snow', { cond: 'snow', cloud: 95, season: 'winter' }, ['sky', 'clouds', 'precip']],
  ['thunder', { cond: 'thunder', cloud: 95 }, ['sky', 'clouds', 'precip']],
  [
    'clear night with moon',
    { phase: 'night', cond: 'clear', cloud: 5, ...moonUp },
    ['sky', 'stars', 'body'],
  ],
  [
    'mostly clear night, full moon',
    {
      phase: 'night',
      cond: 'mostlyClear',
      cloud: 25,
      body: { kind: 'moon', t: 0.6, alt: 30 },
      moon: { illum: 1, tilt: -100, size: 1.2, t: 0.6, alt: 30 },
    },
    ['sky', 'stars', 'body', 'clouds'],
  ],
  [
    'golden hour',
    { phase: 'golden', cond: 'clear', cloud: 5, body: { kind: 'sun', t: 0.92 } },
    ['sky', 'body'],
  ],
];

describe('porthole (package 4, mockup porthole())', () => {
  it.each(STATES)('%s: its layers, round, never moving', (_, o, expected) => {
    for (const theme of ['light', 'dark'] as const) {
      const s = base({ ...o, theme, motion: true });
      const got = layers(s);
      expect(got).toEqual(expect.arrayContaining(expected));
      // the order of the mockup: sky behind, the land in front
      expect(got[0]).toBe('sky');
      const svg = portholeSvg(s, 64);
      expect(svg.viewBox).toBe('0 0 100 100');
      // never moves: no motion class or attribute in the drawing, even when the head's state asks for motion
      expect(svg.inner).not.toMatch(/sc-[a-z]+|data-motion|<animate/);
      // one round crop
      expect(parse(s).querySelector('clipPath circle')).not.toBeNull();
    }
  });

  it('thunder draws the bolt, snow round flakes, rain strokes; the precipitation is one path', () => {
    const marks = (s: SceneState) => parse(s).querySelectorAll('[data-layer="precip"] path');
    expect(marks(base({ cond: 'rain', cloud: 95 }))).toHaveLength(1);
    expect(marks(base({ cond: 'rain', cloud: 95 }))[0]!.getAttribute('stroke')).toBeTruthy();
    expect(marks(base({ cond: 'snow', cloud: 95 }))[0]!.getAttribute('fill')).toBeTruthy();
    expect(marks(base({ cond: 'thunder', cloud: 95 }))).toHaveLength(2);
  });

  it('the moon shows its true phase: the lit shape, the maria only from 48 px', () => {
    const s = base({ phase: 'night', cond: 'clear', cloud: 5, ...moonUp });
    expect(parse(s, 64).querySelector('[data-part="moon"] [data-part="lit"]')).not.toBeNull();
    expect(parse(s, 64).querySelector('[data-part="moon"] ellipse')).not.toBeNull();
    expect(parse(s, 28).querySelector('[data-part="moon"] ellipse')).toBeNull();
    expect(parse(s, 64).querySelector('[data-part="moon"]')!.getAttribute('data-tilt')).toBe(
      '-100',
    );
  });

  it('"Schlicht" keeps sky and body only', () => {
    for (const [, o] of STATES) {
      const got = layers(base({ ...o, level: 'plain' }));
      expect(got.every((l) => l === 'sky' || l === 'body')).toBe(true);
      expect(got).toContain('sky');
    }
  });

  it('"Mond und Himmelsereignisse" off (no moon in the state): no moon in the porthole', () => {
    // sceneOf leaves `moon` out and the night body `none` while the switch is off
    const s = base({ phase: 'night', cond: 'clear', cloud: 5, body: { kind: 'none', t: 0.5 } });
    expect(layers(s)).not.toContain('body');
    expect(parse(s).querySelector('[data-part="moon"]')).toBeNull();
  });

  it('two portholes on one page keep their own ids; colours are declared once as custom properties', () => {
    const s = base({ cond: 'partly', cloud: 50, body: sun });
    const a = portholeSvg(s, 28, 'a');
    const b = portholeSvg(s, 28, 'b');
    const ids = (x: string) => [...x.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(a.inner).some((id) => ids(b.inner).includes(id))).toBe(false);
    expect(a.inner).not.toMatch(/"(var|color-mix)\(--scene/);
    expect(Object.values(a.vars).length).toBeGreaterThan(0);
  });

  it('the component: hidden from assistive tech, 28 / 64 px, no motion attribute, grey in "Ruhig"', () => {
    const s = base({ cond: 'rain', cloud: 95, motion: true });
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
