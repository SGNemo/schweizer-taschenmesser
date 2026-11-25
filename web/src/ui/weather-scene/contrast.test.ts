import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultScene, inkForSky, skyOf, SKY_KEYS, type SkyKey } from '@/core/weather/scene';
import { crestAt, G, skyOffsets } from './draw';

/**
 * Contrast of the text on the weather scene (docs/design/weather-scenes/A11Y.md §1, find A9): for every sky × theme the
 * scene's ink against every stop of the sky's gradient and against the shelter haze (the sky's bottom colour over the
 * low ridges); the opaque parts (chips, hint, module row) and "Ruhig" carry the theme's ink.
 */
const css = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8');

function block(header: string): Record<string, string> {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`block not found: ${header}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim();
  return out;
}
const light = block(':root {\n  --font-sans');
const dark = { ...light, ...block(":root[data-theme='dark']") };
const darkMedia = { ...light, ...block(":root:not([data-theme='light'])") };

const rgb = (hex: string): number[] =>
  hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
const lin = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string): number => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const hex = (c: number[]): string =>
  `#${c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a);
  const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i]! - v) * t));
};
const grey = (h: string): string => {
  const l = lum(h);
  const v = 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
  return hex([v, v, v]);
};

const themes = { light, dark } as const;
const stopsOf = (key: SkyKey, theme: 'light' | 'dark'): string[] =>
  skyOffsets(key, theme).map((_, i) => themes[theme][`--scene-sky-${key}-${i}`]!);

describe('weather scene contrast (A11Y §1)', () => {
  it('every sky has its stops in both themes, and both dark blocks agree', () => {
    for (const key of SKY_KEYS)
      for (const theme of ['light', 'dark'] as const) {
        const stops = stopsOf(key, theme);
        expect(
          stops.every((s) => /^#[0-9a-f]{6}$/.test(s)),
          `${key} ${theme}`,
        ).toBe(true);
      }
    for (const k of Object.keys(dark).filter((k) => k.startsWith('--scene-')))
      expect(darkMedia[k], `${k}: both dark blocks`).toBe(dark[k]);
  });

  it('the ink follows the table of A11Y §1', () => {
    // A11Y §1 row 2: `dust` (package 3) is a light sky with dark ink in the light theme
    const darkInkLight = ['golden', 'day', 'overcast', 'drizzle', 'snow', 'fog', 'heat', 'dust'];
    for (const key of SKY_KEYS) {
      expect(inkForSky(key, 'light'), `${key} light`).toBe(
        darkInkLight.includes(key) ? 'dark' : 'light',
      );
      expect(inkForSky(key, 'dark'), `${key} dark`).toBe('light');
    }
  });

  it.each(SKY_KEYS.flatMap((k) => [[k, 'light'] as const, [k, 'dark'] as const]))(
    '%s, %s theme: the ink is ≥ 4.5 : 1 against every stop and the shelter haze',
    (key, theme) => {
      const ink = light[inkForSky(key, theme) === 'light' ? '--ink-light' : '--ink-dark']!;
      const stops = stopsOf(key, theme);
      for (const s of stops)
        expect(ratio(ink, s), `${key} ${theme} stop ${s}`).toBeGreaterThanOrEqual(4.5);
      const bottom = stops[stops.length - 1]!;
      // The haze is the bottom colour at 75 % over the ridges: at full strength it is the bottom colour itself.
      expect(ratio(ink, bottom), `${key} ${theme} haze`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('"Ruhig" / "Modulfarben: Aus": the grey scene keeps the theme ink ≥ 4.5 : 1', () => {
    for (const theme of ['light', 'dark'] as const) {
      const t = themes[theme];
      const surface = t['--surface']!;
      const text = t['--text']!;
      for (const key of SKY_KEYS)
        for (const s of stopsOf(key, theme))
          expect(
            ratio(text, mix(grey(s), surface, theme === 'dark' ? 0.45 : 0.6)),
            `calm ${key} ${theme}`,
          ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the event skies (package 3) are walked by every loop above, with their palette.js values', () => {
    expect(SKY_KEYS).toEqual(expect.arrayContaining(['dust', 'eclipse-sky']));
    expect(stopsOf('dust', 'light')).toEqual(['#c9b98f', '#ead9ae']);
    expect(stopsOf('dust', 'dark')).toEqual(['#4a442f', '#6a6046']);
    expect(stopsOf('eclipse-sky', 'light')).toEqual(['#141a36', '#3a3f6a']);
    expect(stopsOf('eclipse-sky', 'dark')).toEqual(['#141a36', '#3a3f6a']);
    for (const key of ['dust', 'eclipse-sky'] as const)
      for (const theme of ['light', 'dark'] as const) {
        const ink = light[inkForSky(key, theme) === 'light' ? '--ink-light' : '--ink-dark']!;
        for (const s of stopsOf(key, theme))
          expect(ratio(ink, s), `${key} ${theme} ${s}`).toBeGreaterThanOrEqual(4.5);
      }
  });

  it('aurora (package 3b, handoff 03b test 8): night sky and light ink stay; the glow left of the text edge keeps ≥ 4.5', () => {
    expect([
      light['--scene-aurora-1'],
      light['--scene-aurora-2'],
      light['--scene-aurora-3'],
    ]).toEqual(['#7fe0a8', '#58c7b0', '#a98be0']);
    // The aurora changes no sky key: the text rows keep the night skies walked above.
    const night = { ...defaultScene('light', 11), phase: 'night', event: 'aurora' } as const;
    expect(skyOf({ ...night, eventAmount: 1 }).key).toBe('night');
    const fullMoon = {
      ...night,
      eventAmount: 1,
      body: { kind: 'moon', t: 0.6, alt: 40 },
      moon: { illum: 1, tilt: -119, size: 1.2, t: 0.6, alt: 40 },
    } as const;
    expect(skyOf(fullMoon).key).toBe('night-full');
    // The curtains start right of the quiet edge (WeatherScene.test); only the faint glow reaches left of it. The glow
    // is a radial fade from 0.3 · amount + 0.08 at its centre to 0 at its rim, drawn behind the ridges: its strongest
    // visible pixel left of the edge is at the edge, on its centre row or, where the ridges cover that row, just above
    // the skyline. Desktop: edge x 900; a narrow crop: the edge is quietX, the centre at least 200 right of it. Every
    // stop of the sky stands in for the sky behind (the brightest is the bottom one).
    const A = G.aurora;
    const ink = light['--ink-light']!;
    for (const amt of [0.4, 0.7, 1])
      for (const quiet of [0, 1000, 1060, 1100, 1200, 1300, 1400]) {
        const edge = Math.max(G.shelterX, quiet);
        const cx = Math.max(A.glow[0], edge + 200);
        const rx = A.glow[2] * (0.6 + 0.4 * amt);
        const ry = A.glow[3] * (0.5 + 0.5 * amt);
        const dy = Math.max(0, A.glow[1] - crestAt(edge));
        const t = Math.hypot((cx - edge) / rx, dy / ry);
        const alpha = (0.3 * amt + 0.08) * Math.max(0, 1 - t);
        for (const key of ['night', 'night-full'] as const)
          for (const theme of ['light', 'dark'] as const) {
            expect(inkForSky(key, theme)).toBe('light');
            for (const stop of stopsOf(key, theme))
              expect(
                ratio(ink, mix(stop, light['--scene-aurora-1']!, alpha)),
                `aurora ${amt} quiet ${quiet} ${key} ${theme} ${stop}`,
              ).toBeGreaterThanOrEqual(4.5);
          }
      }
  });

  it('the inks are the app inks, and the opaque parts take the theme ink', () => {
    expect(light['--ink-light']).toBe('#eceff1');
    expect(light['--ink-dark']).toBe('#171f24');
    expect(light['--ink-theme']).toBe('var(--text)');
    expect(light['--ink-theme-muted']).toBe('var(--text-muted)');
  });
});
