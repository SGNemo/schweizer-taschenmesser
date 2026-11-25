// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultScene, type SceneState } from '@/core/weather/scene';
import { litPath, sceneSvg, tiltRotation } from './draw';
import { WeatherScene } from './WeatherScene';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

const base = (o: Partial<SceneState> = {}): SceneState => ({ ...defaultScene('light', 7), ...o });
const parse = (s: SceneState): Document =>
  new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${sceneSvg(s).inner}</svg>`,
    'image/svg+xml',
  );
const size = (s: SceneState): number => {
  const svg = sceneSvg(s);
  return new TextEncoder().encode(svg.inner + JSON.stringify(svg.vars)).length;
};
const layers = (s: SceneState): string[] =>
  [...parse(s).querySelectorAll('[data-layer]')].map((g) => g.getAttribute('data-layer')!);

/** Every state the model can produce at full strength: condition × intensity × phase × wind × frost × theme. */
const CONDS = [
  'clear',
  'mostlyClear',
  'partly',
  'overcast',
  'fog',
  'drizzle',
  'freezingDrizzle',
  'rain',
  'freezingRain',
  'snow',
  'showers',
  'snowShowers',
  'thunder',
  'thunderHail',
] as const;
const ALL: SceneState[] = CONDS.flatMap((cond) =>
  ([1, 2, 3] as const).flatMap((intensity) =>
    (['day', 'night', 'dusk', 'golden'] as const).flatMap((phase) =>
      ([0, 3] as const).map((wind) =>
        base({
          cond,
          intensity,
          phase,
          wind,
          frost: wind === 3 ? 2 : 0,
          snowGround: cond.includes('snow') || wind === 3,
          season: wind === 3 ? 'winter' : 'autumn',
          cloud: cond === 'partly' ? 50 : cond === 'mostlyClear' ? 25 : cond === 'clear' ? 5 : 95,
          // by night a full moon (package 2): the heaviest body with halo ring, maria and ridge highlights
          body: {
            kind: phase === 'day' || phase === 'golden' ? 'sun' : 'moon',
            t: phase === 'golden' ? 0.92 : 0.5,
            alt: 40,
          },
          moon: { illum: 0.995, tilt: -119, size: 1.2, t: 0.7, alt: 30 },
          dayMoon: phase === 'day',
          motion: true,
        }),
      ),
    ),
  ),
);

/** The x of an element's own position (cloud groups carry `data-x`, circles `cx`, paths their first move). */
function xOf(el: Element): number | undefined {
  const dx = el.getAttribute('data-x');
  if (dx) return Number(dx);
  const tr = el.getAttribute('transform')?.match(/^translate\((-?[\d.]+)/);
  if (tr) return Number(tr[1]);
  const cx = el.getAttribute('cx');
  if (cx) return Number(cx);
  const d = el.getAttribute('d');
  const m = d?.match(/^M(-?[\d.]+)/);
  return m ? Number(m[1]) : undefined;
}

describe('weather scene drawing (handoff 01b tests 2)', () => {
  it('a clear summer day: sky, sun, landscape, the shelter; nothing at night but stars', () => {
    expect(layers(base({ body: { kind: 'sun', t: 0.5 } }))).toEqual([
      'sky',
      'body',
      'ridgeAlp',
      'ridgeFar',
      'ridgeMid',
      'lake',
      'ridgeNear',
      'shelter',
    ]);
    const night = layers(base({ phase: 'night', cond: 'mostlyClear', cloud: 15 }));
    expect(night).toContain('stars');
    expect(night).not.toContain('body');
  });

  it('weather draws its layers: deck and rain, fog bands, the bolt, the wind', () => {
    expect(layers(base({ cond: 'rain', cloud: 95 }))).toEqual(
      expect.arrayContaining(['clouds', 'precip']),
    );
    expect(
      parse(base({ cond: 'rain', cloud: 95 })).querySelector('[data-part="deck"]'),
    ).not.toBeNull();
    expect(layers(base({ cond: 'fog', cloud: 0 })).filter((l) => l === 'fog')).toHaveLength(2);
    expect(layers(base({ cond: 'thunder', cloud: 92 }))).toContain('event');
    expect(layers(base({ wind: 2 }))).toContain('wind');
    expect(layers(base({ wind: 1 }))).not.toContain('wind');
  });

  it('"Schlicht": sky and the sun by day, the sky alone at night', () => {
    expect(
      layers(base({ level: 'plain', body: { kind: 'sun', t: 0.5 }, cond: 'rain', cloud: 95 })),
    ).toEqual(['sky']);
    expect(layers(base({ level: 'plain', body: { kind: 'sun', t: 0.5 } }))).toEqual([
      'sky',
      'body',
    ]);
    expect(layers(base({ level: 'plain', phase: 'night' }))).toEqual(['sky']);
  });

  it('nothing with hard contrast left of x = 900 in body, clouds and bolt (the deck may cross)', () => {
    for (const s of ALL) {
      const doc = parse(s);
      for (const name of ['body', 'clouds', 'cloudsFar', 'event']) {
        const g = doc.querySelector(`[data-layer="${name}"]`);
        if (!g) continue;
        const marks =
          name === 'body'
            ? [
                ...[...g.querySelectorAll('circle')].filter((c) => !c.closest('[data-part]')),
                ...g.querySelectorAll('[data-part="moon"]'),
              ]
            : [...g.querySelectorAll('[data-x], path')];
        for (const el of marks) {
          if (
            el.getAttribute('data-part') === 'deck' ||
            (el.closest('[data-x]') !== el && el.tagName === 'path')
          )
            continue;
          if (el.getAttribute('stroke')) continue; // wind streaks behind a cloud
          const x = xOf(el);
          if (x == null) continue;
          expect(x, `${s.cond} ${s.phase} ${name}`).toBeGreaterThanOrEqual(900);
        }
      }
    }
  });

  it('stays under the ceiling of A11Y §4: ≤ 220 elements, ≤ 48 KB, ≤ 9 animated groups', () => {
    let heaviest = 0;
    let largest = 0;
    let animated = 0;
    for (const s of ALL) {
      const svg = sceneSvg(s);
      heaviest = Math.max(heaviest, (svg.inner.match(/<[a-zA-Z]/g) ?? []).length);
      largest = Math.max(largest, size(s));
      animated = Math.max(animated, (svg.inner.match(/class="sc-/g) ?? []).length);
    }
    expect(heaviest).toBeLessThanOrEqual(220);
    expect(largest).toBeLessThanOrEqual(48 * 1024);
    expect(animated).toBeLessThanOrEqual(9);
  });

  it('is pure: the same state gives the same picture; colours are tokens, never literals', () => {
    const s = base({ cond: 'snow', intensity: 3, cloud: 95, phase: 'dusk', snowGround: true });
    expect(sceneSvg(s).inner).toBe(sceneSvg(s).inner);
    expect(sceneSvg(s).inner).not.toMatch(/#[0-9a-fA-F]{3,6}\b(?!\))/);
    expect(Object.values(sceneSvg(s).vars).join(' ')).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('a narrow crop keeps clouds and caps right of the text (quietX)', () => {
    const s = base({ cond: 'partly', cloud: 70, season: 'winter', body: { kind: 'sun', t: 0.5 } });
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${sceneSvg(s, { quietX: 1200 }).inner}</svg>`,
      'image/svg+xml',
    );
    for (const g of doc.querySelectorAll('[data-layer^="clouds"] [data-x]'))
      expect(Number(g.getAttribute('data-x'))).toBeGreaterThanOrEqual(1200 - 100);
  });
});

describe('<WeatherScene>', () => {
  it('is hidden from assistive tech and carries phase, condition, ink and the old sky kind', () => {
    render(
      <WeatherScene state={base({ phase: 'night', cond: 'snow', cloud: 95 })} legacyKind="night" />,
    );
    const svg = screen.getByTestId('weather-scene');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-phase', 'night');
    expect(svg).toHaveAttribute('data-cond', 'snow');
    expect(svg).toHaveAttribute('data-ink', 'light');
    const wrap = screen.getByTestId('sky');
    expect(wrap).toHaveAttribute('data-sky', 'night');
    expect(wrap.querySelector('span')).not.toBeNull();
  });

  it('moves five seconds after opening, then rests; never with reduced motion, a still picture or "Ruhig"', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <WeatherScene state={base({ motion: true, cond: 'rain', cloud: 95 })} />,
    );
    const svg = screen.getByTestId('weather-scene');
    expect(svg).toHaveAttribute('data-motion', 'run');
    expect(svg.innerHTML).toContain('sc-fall');
    vi.advanceTimersByTime(5000);
    rerender(<WeatherScene state={base({ motion: true, cond: 'rain', cloud: 95 })} />);
    expect(screen.getByTestId('weather-scene')).toHaveAttribute('data-motion', 'rest');
    cleanup();
    render(<WeatherScene state={base({ motion: false, cond: 'rain', cloud: 95 })} />);
    expect(screen.getByTestId('weather-scene')).not.toHaveAttribute('data-motion');
    expect(screen.getByTestId('weather-scene').innerHTML).not.toContain('sc-');
    cleanup();
    render(<WeatherScene state={base({ motion: true, calm: true, cond: 'rain', cloud: 95 })} />);
    expect(screen.getByTestId('weather-scene')).not.toHaveAttribute('data-motion');
    cleanup();
    document.documentElement.dataset.motion = 'reduce';
    render(<WeatherScene state={base({ motion: true, cond: 'rain', cloud: 95 })} />);
    expect(screen.getByTestId('weather-scene')).not.toHaveAttribute('data-motion');
  });

  it('"Ruhig" takes the theme ink (dark ink on the light theme, even at night)', () => {
    render(<WeatherScene state={base({ calm: true, phase: 'night' })} />);
    expect(screen.getByTestId('weather-scene')).toHaveAttribute('data-ink', 'dark');
  });
});

describe('the moon (package 2)', () => {
  const night = (illum: number, tilt: number, size = 1): SceneState =>
    base({
      phase: 'night',
      cond: 'clear',
      cloud: 5,
      body: { kind: 'moon', t: 0.6, alt: 40 },
      moon: { illum, tilt, size },
    });

  it('eight phases: the lit shape by its parameters (not pixels)', () => {
    const shapes = [0.01, 0.15, 0.5, 0.8, 1, 0.8, 0.5, 0.15].map((k) => litPath(10, k));
    expect(shapes).toMatchInlineSnapshot(`
      [
        null,
        "M0,-10A10,10 0 0 1 0,10A7,10 0 0 0 0,-10Z",
        "M0,-10A10,10 0 0 1 0,10A0,10 0 0 1 0,-10Z",
        "M0,-10A10,10 0 0 1 0,10A6,10 0 0 1 0,-10Z",
        "M-10,0a10,10 0 1,1 20,0a10,10 0 1,1 -20,0",
        "M0,-10A10,10 0 0 1 0,10A6,10 0 0 1 0,-10Z",
        "M0,-10A10,10 0 0 1 0,10A0,10 0 0 1 0,-10Z",
        "M0,-10A10,10 0 0 1 0,10A7,10 0 0 0 0,-10Z",
      ]
    `);
  });

  it('turns the lit side to its tilt: + left of up, − right; north and south differ in sign', () => {
    expect(tiltRotation(-90)).toBe(0); // lit side to the right: the shape as drawn
    expect(tiltRotation(0)).toBe(-90); // lit side up
    expect(tiltRotation(90)).toBe(-180); // lit side to the left
    const g = parse(night(0.3, -147.6)).querySelector('[data-part="moon"]')!;
    expect(g.getAttribute('transform')).toContain(
      `rotate(${Math.round(tiltRotation(-147.6) * 10) / 10})`,
    );
    expect(g.querySelector('[data-part="lit"]')).not.toBeNull();
  });

  it('a new moon is a thin ring; a crescent shows earthshine; a full moon its ring and its own sky', () => {
    const newMoon = parse(night(0.01, 0)).querySelector('[data-part="moon"]')!;
    expect(newMoon.querySelector('[data-part="lit"]')).toBeNull();
    expect(newMoon.querySelectorAll('circle').length).toBeGreaterThan(0);
    const full = parse(night(0.995, -119, 1.2));
    expect(full.querySelector('[data-part="moon"] [stroke]')).not.toBeNull(); // the halo ring
    expect(JSON.stringify(sceneSvg(night(0.995, -119, 1.2)).vars)).toContain(
      '--scene-sky-night-full-0',
    );
  });

  it('the moon thins the stars; below the horizon there is none', () => {
    const count = (s: SceneState) =>
      (sceneSvg(s).inner.match(/a[\d.]+,[\d.]+ 0 1,1/g) ?? []).length;
    expect(count(night(1, 0))).toBeLessThan(
      count(base({ phase: 'night', cond: 'clear', cloud: 5 })),
    );
    expect(layers(base({ phase: 'night', body: { kind: 'none', t: 0.5 } }))).not.toContain('body');
  });

  it('day moon: small and pale beside the sun, not in a phone crop', () => {
    const day = base({
      body: { kind: 'sun', t: 0.3 },
      moon: { illum: 0.6, tilt: -40, size: 1, t: 0.8, alt: 30 },
      dayMoon: true,
    });
    expect(parse(day).querySelector('[data-part="dayMoon"]')).not.toBeNull();
    const phone = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${sceneSvg(day, { bodyAt: [1480, 90] }).inner}</svg>`,
      'image/svg+xml',
    );
    expect(phone.querySelector('[data-part="dayMoon"]')).toBeNull();
  });
});
