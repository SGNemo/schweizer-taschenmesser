import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTES } from '@/core/supporter/palette';
import { t } from '@/strings';

const themes = readFileSync(resolve(__dirname, 'supporterThemes.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');

/** Custom properties of the first block that follows `header`. */
function block(css: string, header: string): Record<string, string> {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`block not found: ${header}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim();
  return out;
}

const lum = (hex: string): number => {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const channels = (hex: string) =>
  hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
/** `fg` at `alpha` over `bg` (what `color-mix(fg alpha%, transparent)` looks like there). */
const mix = (fg: string, bg: string, alpha: number): string =>
  `#${channels(fg)
    .map((c, i) =>
      Math.round(c * alpha + channels(bg)[i]! * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

const KEYS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--border',
  '--border-strong',
  '--text',
  '--text-muted',
  '--text-3',
  '--focus',
  '--accent',
  '--accent-hover',
  '--accent-contrast',
  '--accent-soft',
];

const baseLight = block(tokens, ':root {\n  --font-sans');
const baseDark = block(tokens, ":root[data-theme='dark']");
// Status colours and chart series are not overridden by a theme: they must hold on its surfaces.
const UNTOUCHED = ['--danger', '--success', '--warning', '--info', '--viz-1', '--viz-2'];

describe('supporter colour themes', () => {
  it('every theme in the picker has a CSS block, a name and the same set of tokens', () => {
    for (const id of PALETTES) {
      const b = block(themes, `:root[data-palette='${id}']`);
      expect(Object.keys(b).sort(), id).toEqual([...KEYS].sort());
      expect(t.supporter.palette.names[id], id).toBeTruthy();
      expect(themes).toContain(`[data-palette-preview='${id}']`);
    }
    expect(PALETTES.length).toBeGreaterThanOrEqual(3);
    expect(PALETTES.length).toBeLessThanOrEqual(5);
  });

  it('only restyles colours (no layout, motion or type tokens, no raw colours outside pairs)', () => {
    const decl = [...themes.matchAll(/^\s+(--[\w-]+):/gm)].map((m) => m[1]!);
    for (const key of new Set(decl)) expect([...KEYS, '--logo-ink'], key).toContain(key);
    for (const id of PALETTES)
      for (const [k, v] of Object.entries(block(themes, `:root[data-palette='${id}']`)))
        expect(v, `${id} ${k}`).toMatch(/^light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });

  for (const id of PALETTES) {
    for (const [i, scheme] of (['light', 'dark'] as const).entries()) {
      describe(`${id} / ${scheme}: WCAG AA`, () => {
        const raw = block(themes, `:root[data-palette='${id}']`);
        const base = scheme === 'light' ? baseLight : baseDark;
        const c: Record<string, string> = Object.fromEntries(UNTOUCHED.map((k) => [k, base[k]!]));
        for (const k of KEYS) c[k] = raw[k]!.match(/#[0-9a-f]{6}/g)![i]!;
        const min = (fg: string, bg: string, m = 4.5) =>
          expect(ratio(c[fg]!, c[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(m);

        it('text, accent and filled accent', () => {
          for (const bg of ['--bg', '--surface', '--surface-2']) {
            min('--text', bg);
            min('--text-muted', bg);
            min('--text-3', bg);
          }
          min('--accent', '--surface');
          min('--accent', '--bg');
          min('--accent', '--accent-soft');
          min('--accent-hover', '--surface');
          min('--text', '--accent-soft');
          min('--accent-contrast', '--accent');
        });

        it('status colours and their badge ink (15 % background) on every surface', () => {
          for (const s of ['--danger', '--success', '--warning', '--info']) {
            min(s, '--surface');
            min(s, '--bg');
            const ink = mix(c['--text']!, c[s]!, 0.15);
            for (const bg of ['--bg', '--surface', '--surface-2'])
              expect(
                ratio(ink, mix(c[s]!, c[bg]!, 0.15)),
                `${s}-ink on ${s}-soft over ${bg}`,
              ).toBeGreaterThanOrEqual(4.5);
          }
        });

        it('form borders, focus ring and chart series reach 3:1', () => {
          min('--border-strong', '--surface', 3);
          min('--border-strong', '--surface-2', 3);
          for (const bg of ['--bg', '--surface', '--surface-2']) min('--focus', bg, 3);
          min('--viz-1', '--surface', 3);
          min('--viz-2', '--surface', 3);
        });
      });
    }
  }
});
