import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Forecast } from '@/core/weather/api';
import { sceneOf, type SceneHour, type SceneState, type SkyKey } from '@/core/weather/scene';
import { G, phoneView, sceneSvg, skyOffsets, type SceneSvg } from './draw';
import { CARD_QUIET_SHARE, cardFit } from './useSceneFit';

/**
 * Contrast of the text on the round-2 picture (docs/design/weather-scenes-2/A11Y.md §1): every sky key × theme, the
 * scene's ink against what can stand under text – every stop of the sky, every far layer's hazed tone (the quiet
 * side), the deck and storm sheets, and, on the phone, the sky and the deck above the summits. The colours are the
 * scene's own CSS (`color-mix` of tokens, the grey tokens included), evaluated with the token values of the theme.
 */
const css = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8');
function block(header: string): Record<string, string> {
  const start = css.indexOf(header);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim();
  return out;
}
const light = block(':root {\n  --font-sans');
const themes = { light, dark: { ...light, ...block(":root[data-theme='dark']") } } as const;

type RGB = [number, number, number];
const hexRgb = (h: string): RGB =>
  h
    .replace('#', '')
    .match(/../g)!
    .map((x) => parseInt(x, 16)) as RGB;
const lin = (c: number) =>
  c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4;
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const mixRgb = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i]! - v) * t) as RGB;

/** Evaluates the scene's colour expressions: `var(--cN)`, `var(--scene-*)`, keywords, `color-mix`. */
function evaluator(vars: Record<string, string>, theme: 'light' | 'dark') {
  const t = themes[theme];
  const memo = new Map<string, RGB>();
  const ev = (x: string): RGB => {
    x = x.trim();
    const hit = memo.get(x);
    if (hit) return hit;
    let r: RGB;
    if (x === 'white') r = [255, 255, 255];
    else if (x === 'black') r = [0, 0, 0];
    else if (x.startsWith('#')) r = hexRgb(x);
    else if (x.startsWith('var(')) {
      const name = x.slice(4, -1);
      r = ev(
        vars[name] ??
          t[name] ??
          (() => {
            throw new Error(`unknown ${name}`);
          })(),
      );
    } else if (x.startsWith('color-mix(')) {
      const m = /^color-mix\(in srgb, (var\([^)]+\)|\w+), (var\([^)]+\)|\w+) ([\d.]+)%\)$/.exec(x)!;
      r = mixRgb(ev(m[1]!), ev(m[2]!), Number(m[3]) / 100);
    } else throw new Error(`cannot read ${x}`);
    const rounded = r.map((v) => Math.max(0, Math.min(255, Math.round(v)))) as RGB;
    memo.set(x, rounded);
    return rounded;
  };
  return ev;
}

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
const MOON = { lit: 0.8, tilt: 30, alt: 35, az: 170, full: false, superMoon: false };
/** One state per sky key (the mockup's measure list) and the heaviest cases. */
const CASES: [string, string, SceneHour, Partial<SceneState>?][] = [
  ['day', '12:00', { code: 0, cloud: 5 }],
  ['heat', '12:00', { code: 0, temp: 32 }],
  ['golden', '20:50', { code: 0 }],
  ['dawn', '05:00', { code: 0, night: true }],
  ['dusk', '21:50', { code: 0, night: true }],
  ['overcast', '12:00', { code: 3, cloud: 95 }],
  ['drizzle', '12:00', { code: 53, cloud: 100 }],
  ['rain', '12:00', { code: 63, cloud: 100 }],
  ['storm', '12:00', { code: 95, mm: 4 }],
  ['snow', '12:00', { code: 73, cloud: 100, snowDepth: 0.1, temp: -2 }],
  ['fog', '12:00', { code: 45, vis: 800 }],
  ['dust', '12:00', { code: 0 }, { event: 'dust' }],
  ['eclipse-sky', '12:00', { code: 0 }, { event: 'solarTotal' }],
  ['night', '01:00', { code: 0, night: true }],
  ['night-full', '01:00', { code: 0, night: true }, { moon: { illum: 1, tilt: 0, size: 1.2 } }],
  ['night-overcast', '01:00', { code: 3, cloud: 95, night: true }],
  ['night-rain', '01:00', { code: 63, cloud: 100, night: true }],
  ['night-snow', '01:00', { code: 73, cloud: 100, night: true, temp: -2 }],
  ['night-fog', '01:00', { code: 45, vis: 800, night: true }],
  ['storm', '12:00', { code: 99, wind: 60, mm: 12 }], // storm 3 + hail + wind 3
  ['snow', '12:00', { code: 75, wind: 60, snowDepth: 0.3, temp: -3 }], // snow 3 + wind 3
  ['day', '12:00', { code: 2, cloud: 80, wind: 25 }], // broken cover (3)
  ['fog', '12:00', { code: 45, vis: 200 }], // fog 2
];
function stateOf(
  time: string,
  h: SceneHour,
  over: Partial<SceneState>,
  theme: 'light' | 'dark',
  season: 'summer' | 'winter',
): SceneState {
  const night = !!h.night;
  const date = season === 'winter' ? '2026-01-15' : '2026-07-02';
  const s = sceneOf({
    forecast: forecast(night, `${date}T${time}`),
    hour: { temp: 12, ...h, time: `${date}T${time}` },
    at: 0,
    nowMs: 0,
    lat: 47,
    theme,
    moon: night ? MOON : undefined,
  });
  const m = { ...s, ...over };
  if (over.event === 'solarTotal' || over.event === 'dust') m.eventAmount = 1;
  if (over.moon) m.body = { kind: 'moon', t: 0.5, alt: 40 };
  return m;
}

/** The tones under text: sky stops, the hazed stop of every far layer's gradient, the cloud sheets; translucent things over the sky's bottom. */
function tonesUnderText(
  d: SceneSvg,
  s: SceneState,
  theme: 'light' | 'dark',
  phone: boolean,
  quietX = 640,
  /** The right edge of the text, scene units (the head: the quiet edge; the card: 80 before it). */
  textX = quietX,
): { what: string; c: RGB }[] {
  const ev = evaluator(d.vars, theme);
  const out: { what: string; c: RGB }[] = [];
  const key = d.sky;
  skyOffsets(key, theme).forEach((_, i) =>
    out.push({ what: `sky ${i}`, c: ev(`var(--scene-sky-${key}-${i})`) }),
  );
  const bottom = ev(`var(--scene-sky-${key}-${skyOffsets(key, theme).length - 1})`);
  if (!phone) {
    // the quiet side: every far layer is a gradient whose first stops are its hazed tone
    for (const g of d.inner.matchAll(
      /<linearGradient x1="0" y1="0" x2="(\d+)" y2="0" gradientUnits="userSpaceOnUse" id="[^"]+"><stop offset="0" stop-color="([^"]+)"/g,
    ))
      out.push({ what: `hazed layer`, c: ev(g[2]!) });
  }
  // the deck's and the storm base's sheets run across the whole width
  for (const p of d.inner.matchAll(/<path d="[^"]+" fill="([^"]+)" data-part="deck"/g))
    out.push({ what: 'deck', c: ev(p[1]!) });
  // Fog bands start 80 units left of the quiet edge and fade in over 22 % of their width (draw.ts `fogBand`): at the
  // text column's right edge (the quiet edge) a band shows at that share of its opacity. The strongest band (0.6 in
  // fog 2) and, in fog 2, the veil (0.24, the same fade) over the sky's bottom.
  if (s.fog && !phone) {
    const q0 = quietX;
    const bx = q0 - 80;
    const fade = Math.max(0, Math.min(1, (textX - bx) / (G.W + 200 - q0) / 0.22));
    const fogC = ev(
      `color-mix(in srgb, var(--scene-sky-${key}-${skyOffsets(key, theme).length - 1}), white 55%)`,
    );
    let c = mixRgb(bottom, fogC, (s.fog >= 2 ? 0.6 : 0.5) * fade);
    if (s.fog >= 2) c = mixRgb(c, fogC, 0.24 * fade);
    out.push({ what: 'fog bands at the quiet edge', c });
  }
  return out;
}

describe('round 2: text on the picture ≥ 4.5 : 1 (A11Y §1)', () => {
  for (const theme of ['light', 'dark'] as const)
    for (const season of ['summer', 'winter'] as const)
      it.each(CASES)(`%s (${theme}, ${season}) at %s %o`, (key, time, h, over = {}) => {
        const s = stateOf(time, h, over, theme, season);
        for (const phone of [false, true]) {
          const d = sceneSvg(
            s,
            phone
              ? { phone: true, view: phoneView(412, 256), quietX: G.phone.quietX }
              : { quietX: 640 },
          );
          expect(d.sky).toBe(key);
          const ink = hexRgb(light[d.ink === 'light' ? '--ink-light' : '--ink-dark']!);
          for (const t of tonesUnderText(d, s, theme, phone))
            expect(
              ratio(ink, t.c),
              `${key} ${theme} ${season} ${phone ? 'phone' : 'wide'} ${t.what} rgb(${t.c.join(',')})`,
            ).toBeGreaterThanOrEqual(4.5);
        }
      });
});

// Package D, grown after it (the picture was a thin strip on a tall card, none on the wide ones): the card draws the
// picture as large as its text allows (`cardFit`, at most the phone head's 0.46), right-aligned. The text rows meet the
// sky, the deck and the hazed far layers only – the ground and every tree left of the quiet edge lie below the lowest
// text row. Sizes: the low cards of package D (no measured text: it ends 24 px above the bottom) and the tall and wide
// cards of the overview with the text as measured (right edge of the rain chip, bottom of the word line).
describe('round 2: the widget card at its sizes', () => {
  const TEXT = { right: 240, bottom: 185 };
  const SIZES = [
    [379, 205, undefined],
    [379, 282, undefined],
    [380, 192, undefined],
    [380, 400, TEXT],
    [780, 400, TEXT],
    [1180, 400, TEXT],
  ] as const;
  it.each(SIZES)(
    '%i × %i: as large as the text allows, ground and trees below the text',
    (W, H, text) => {
      const fit = cardFit(W, H, CARD_QUIET_SHARE, text);
      const [x0, y0, vw, vh] = fit.view!;
      expect(x0 + vw).toBe(G.W);
      expect(vw).toBeLessThanOrEqual(G.W);
      expect(W / vw).toBeCloseTo(H / vh, 2);
      const k = W / vw;
      expect(k).toBeLessThanOrEqual(Math.max(G.phone.k, W / G.W) + 0.005);
      const textBottom = y0 + (text?.bottom ?? H - 24) / k;
      let top = Infinity;
      for (const [x, y] of G.ground) if (x >= x0 && x <= fit.quietX!) top = Math.min(top, y);
      for (const t of [...G.trees, ...G.behind])
        if (t[1] + t[3] >= x0 && t[1] - t[3] <= fit.quietX!)
          top = Math.min(top, t[2] - (t[0] === 'bush' ? 2 * t[3] : t[3]));
      expect(textBottom, `text to ${Math.round(textBottom)}, land from ${top}`).toBeLessThan(top);
    },
  );
  it('a tall card shows the land as large as the phone head, a low one more of the panorama, a wide one all of it', () => {
    expect(cardFit(380, 400, CARD_QUIET_SHARE, TEXT).view![2]).toBe(Math.round(380 / G.phone.k));
    expect(cardFit(380, 192, CARD_QUIET_SHARE).view![2]).toBeGreaterThan(
      Math.round(380 / G.phone.k),
    );
    expect(cardFit(1180, 400, CARD_QUIET_SHARE, TEXT).view![2]).toBe(G.W);
  });
  for (const theme of ['light', 'dark'] as const)
    for (const season of ['summer', 'winter'] as const)
      it.each(CASES)(
        `%s (${theme}, ${season}) at %s %o: the card's text ≥ 4.5 : 1`,
        (key, time, h, over = {}) => {
          const s = stateOf(time, h, over, theme, season);
          for (const [W, H, text] of SIZES) {
            const fit = cardFit(W, H, CARD_QUIET_SHARE, text);
            const d = sceneSvg(s, fit);
            expect(d.sky).toBe(key);
            const ink = hexRgb(light[d.ink === 'light' ? '--ink-light' : '--ink-dark']!);
            const [x0, , vw] = fit.view!;
            const textX = x0 + ((text?.right ?? W * CARD_QUIET_SHARE) * vw) / W;
            for (const t of tonesUnderText(d, s, theme, false, fit.quietX, textX))
              expect(
                ratio(ink, t.c),
                `${key} ${theme} ${season} ${W}×${H} ${t.what} rgb(${t.c.join(',')})`,
              ).toBeGreaterThanOrEqual(4.5);
          }
        },
      );
});

describe('round 2 tokens', () => {
  it('every deck, light and land token of palette.js is a token, the theme-dependent decks in both dark blocks', () => {
    for (const sky of ['night', 'night-wet', 'day', 'wet', 'storm', 'snow', 'twilight'])
      for (let i = 0; i < 5; i++)
        expect(light[`--scene-deck-${sky}-${i}`], `${sky} ${i}`).toMatch(/^#[0-9a-f]{6}$/);
    const darkBlock = block(":root[data-theme='dark']");
    const darkMedia = block(":root:not([data-theme='light'])");
    for (const sky of ['day', 'wet', 'storm', 'snow'])
      for (let i = 0; i < 5; i++) {
        expect(darkBlock[`--scene-deck-${sky}-${i}`]).toMatch(/^#[0-9a-f]{6}$/);
        expect(darkMedia[`--scene-deck-${sky}-${i}`]).toBe(darkBlock[`--scene-deck-${sky}-${i}`]);
      }
    for (const season of ['spring', 'summer', 'autumn', 'winter'])
      for (const n of ['rock', 'mid', 'f1', 'f2', 'near', 'meadow', 'dark'])
        expect(light[`--scene-land-${season}-${n}`]).toMatch(/^#[0-9a-f]{6}$/);
    for (const k of [
      'day',
      'heat',
      'golden',
      'overcast',
      'drizzle',
      'rain',
      'storm',
      'snow',
      'fog',
      'dust',
      'dawn',
      'dusk',
      'night',
      'night-full',
      'eclipse-sky',
      'dark-theme',
    ])
      expect(light[`--scene-light-${k}`], k).toMatch(/^#[0-9a-f]{6}$/);
    // the four skies round 2 changes (palette.js header)
    expect([
      light['--scene-sky-day-0'],
      light['--scene-sky-storm-0'],
      light['--scene-sky-night-overcast-0'],
      light['--scene-sky-night-rain-0'],
    ]).toEqual(['#4696dd', '#232b38', '#222a3d', '#1a2130']);
  });
  it('every grey token is the greying of its colour (0.3 R + 0.59 G + 0.11 B, palette.js greyOf)', () => {
    const greys = Object.keys(light).filter((k) => k.startsWith('--scene-grey-'));
    expect(greys.length).toBeGreaterThan(40);
    for (const g of greys) {
      const src = light[`--scene-${g.slice('--scene-grey-'.length)}`]!;
      const c = hexRgb(src);
      const v = Math.round(0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]);
      expect(hexRgb(light[g]!), g).toEqual([v, v, v]);
    }
  });
  it('the sky keys walked here are all the drawing can produce', () => {
    const keys = new Set<SkyKey>(CASES.map((c) => c[0] as SkyKey));
    expect(keys.size).toBe(19);
  });
});
