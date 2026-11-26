// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultScene, type SceneState } from '@/core/weather/scene';
import { litPath, sceneSvg, tiltRotation } from './draw';
import { CARD_QUIET_SHARE, cardFit } from './useSceneFit';
import { WeatherScene } from './WeatherScene';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

const base = (o: Partial<SceneState> = {}): SceneState => ({
  ...defaultScene('light', 7),
  mode: 'clear',
  ...o,
});
const parse = (s: SceneState): Document =>
  new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${sceneSvg(s).inner}</svg>`,
    'image/svg+xml',
  );

describe('<WeatherScene>', () => {
  it('is hidden from assistive tech and carries phase, condition and ink (no old sky kind any more)', () => {
    render(<WeatherScene state={base({ phase: 'night', cond: 'snow', cloud: 95 })} />);
    const svg = screen.getByTestId('weather-scene');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-phase', 'night');
    expect(svg).toHaveAttribute('data-cond', 'snow');
    expect(svg).toHaveAttribute('data-ink', 'light');
    const wrap = screen.getByTestId('sky');
    expect(wrap).not.toHaveAttribute('data-sky');
    expect(wrap.querySelector('span')).toBeNull();
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

  it('as a card (the overview widget): the new panorama, right-aligned, reaching up into more sky', () => {
    const fit = cardFit(379, 205, CARD_QUIET_SHARE);
    const [x0, , vw] = fit.view!;
    expect(x0 + vw).toBe(1600);
    expect(fit.view![1]).toBeLessThan(0);
    // the quiet zone ends right of the text (a fog band starts only after it), the body right of that
    expect(fit.quietX).toBeGreaterThan(Math.round(x0 + (379 * CARD_QUIET_SHARE * vw) / 379));
    expect(fit.bodyAt![0]).toBeGreaterThan(fit.quietX!);
    expect(fit.bodyAt![1]).toBeGreaterThan(fit.view![1]);
    // jsdom measures nothing: the card's box is 379 × 205 for this render
    const box = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 379,
      bottom: 205,
      width: 379,
      height: 205,
    } as DOMRect);
    try {
      render(
        <WeatherScene state={base({ cond: 'partly', cover: 2 })} quietShare={CARD_QUIET_SHARE} />,
      );
      const svg = screen.getByTestId('weather-scene');
      // the card's view (cardFit), not the head's
      expect(svg.getAttribute('viewBox')).toBe(fit.view!.join(' '));
      // round 2's massif (`G.mountains`), not round 1's ridges
      expect(svg.querySelector('[data-part="main"]')).not.toBeNull();
    } finally {
      box.mockRestore();
    }
  });
});

describe('the moon (package 2)', () => {
  it('eight phases: the lit shape by its parameters (not pixels)', () => {
    const shapes = [0.01, 0.15, 0.5, 0.8, 1, 0.8, 0.5, 0.15].map((k) => litPath(10, k));
    expect(shapes).toEqual([
      null,
      'M0,-10A10,10 0 0 1 0,10A7,10 0 0 0 0,-10Z',
      'M0,-10A10,10 0 0 1 0,10A0,10 0 0 1 0,-10Z',
      'M0,-10A10,10 0 0 1 0,10A6,10 0 0 1 0,-10Z',
      'M-10,0a10,10 0 1,1 20,0a10,10 0 1,1 -20,0Z',
      'M0,-10A10,10 0 0 1 0,10A6,10 0 0 1 0,-10Z',
      'M0,-10A10,10 0 0 1 0,10A0,10 0 0 1 0,-10Z',
      'M0,-10A10,10 0 0 1 0,10A7,10 0 0 0 0,-10Z',
    ]);
  });

  it('turns the lit side to its tilt: + left of up, − right; the drawing carries the turn', () => {
    expect(tiltRotation(-90)).toBe(0); // lit side to the right: the shape as drawn
    expect(tiltRotation(0)).toBe(-90); // lit side up
    expect(tiltRotation(90)).toBe(-180); // lit side to the left
    const night = base({
      phase: 'night',
      body: { kind: 'moon', t: 0.6, alt: 40 },
      moon: { illum: 0.3, tilt: -147.6, size: 1 },
    });
    const g = parse(night).querySelector('[data-part="moon"]')!;
    const rot = Number(/rotate\((-?[\d.]+)/.exec(g.getAttribute('transform')!)![1]);
    expect(rot).toBeCloseTo(tiltRotation(-147.6), 3);
  });
});

describe('sky events in the new picture (round 2, events.js)', () => {
  const sun = { kind: 'sun', t: 0.5 } as const;
  const moonBody = { kind: 'moon', t: 0.6, alt: 40 } as const;
  const fullMoon = { illum: 1, tilt: -119, size: 1.2, t: 0.6, alt: 40 };
  /** Each event in a state the model lets through, with the parts it must draw. */
  const CASES: [string, SceneState, string[]][] = [
    ['solarPartial', base({ body: sun, event: 'solarPartial', eventAmount: 0.7 }), ['bite']],
    ['solarAnnular', base({ body: sun, event: 'solarAnnular', eventAmount: 0.9 }), ['annular']],
    ['solarTotal', base({ body: sun, event: 'solarTotal', eventAmount: 1 }), ['corona']],
    [
      'lunarPartial',
      base({
        phase: 'night',
        body: moonBody,
        moon: fullMoon,
        event: 'lunarPartial',
        eventAmount: 0.4,
      }),
      ['umbra'],
    ],
    [
      'lunarTotal',
      base({ phase: 'night', body: moonBody, moon: fullMoon, event: 'lunarTotal', eventAmount: 1 }),
      ['copper'],
    ],
    [
      'meteors',
      base({ phase: 'night', cloud: 30, cond: 'partly', event: 'meteors', eventAmount: 1 }),
      ['meteors'],
    ],
    ['starNight', base({ phase: 'night', event: 'starNight', eventAmount: 1 }), ['milky']],
    [
      'rainbow',
      base({
        cond: 'showers',
        cloud: 60,
        body: { kind: 'none', t: 0.3 },
        event: 'rainbow',
        eventAmount: 1,
      }),
      ['rainbow'],
    ],
    ['dust', base({ body: sun, event: 'dust', eventAmount: 1 }), ['dustSun']],
    // package 3b: the aurora at its three strengths (CONCEPT-SOURCES §2)
    ...([0.4, 0.7, 1] as const).map((a): [string, SceneState, string[]] => [
      `aurora ${a}`,
      base({ phase: 'night', cloud: 40, cond: 'partly', event: 'aurora', eventAmount: a }),
      ['aurora', 'auroraGlow'],
    ]),
  ];
  const moving = (s: SceneState): SceneState => ({ ...s, motion: true, wind: 3 });

  it.each(CASES)('%s draws its parts, and none of them moves', (_, s, parts) => {
    for (const st of [s, moving(s)]) {
      const doc = parse(st);
      for (const part of parts) {
        const el = doc.querySelector(`[data-part="${part}"]`);
        expect(el, part).not.toBeNull();
        for (let n: Element | null = el; n; n = n.parentElement) {
          expect(n.getAttribute('class') ?? '', `${part} in a motion group`).not.toMatch(/sc-/);
          expect(n.getAttribute('style') ?? '', part).not.toMatch(/animation|--dur/);
        }
      }
    }
  });
});
