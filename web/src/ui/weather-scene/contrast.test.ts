import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inkForSky, SKY_KEYS, type SkyKey } from '@/core/weather/scene';
import { skyOffsets } from './draw';

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
    const darkInkLight = ['golden', 'day', 'overcast', 'drizzle', 'snow', 'fog', 'heat'];
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

  it('the inks are the app inks, and the opaque parts take the theme ink', () => {
    expect(light['--ink-light']).toBe('#eceff1');
    expect(light['--ink-dark']).toBe('#171f24');
    expect(light['--ink-theme']).toBe('var(--text)');
    expect(light['--ink-theme-muted']).toBe('var(--text-muted)');
  });
});
