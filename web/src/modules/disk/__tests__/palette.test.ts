import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FILE_KINDS } from '@/core/platform/disk';
import { AGE_VAR } from '../logic/age';
import { KIND_VAR, textOn, toHex } from '../logic/colors';

/**
 * Identity v3.1 (G01): the treemap palette is made of tokens only, and every file-type and age colour stays
 * ≥ 3:1 against `--surface` in both themes (WCAG 1.4.11, graphical objects).
 */
/** Without comments, so a token named in prose is never read as a declaration. */
const palette = readFileSync(resolve(__dirname, '../components/Palette.module.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const tokens = readFileSync(resolve(__dirname, '../../../ui/tokens.css'), 'utf8');

/** Custom properties of the first block that follows `header`. */
function block(css: string, header: string): Record<string, string> {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`block not found: ${header}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim().replace(/\s+/g, ' ');
  return out;
}

const light = block(tokens, ':root {\n  --font-sans');
const themes = {
  light,
  dark: { ...light, ...block(tokens, ":root[data-theme='dark']") },
  systemDark: { ...light, ...block(tokens, ":root:not([data-theme='light'])") },
};
const own = block(palette, '.palette');

const rgb = (hex: string) => hex.match(/[0-9a-f]{2}/gi)!.map((h) => parseInt(h, 16));
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/** Resolves `var(--x)`, `color-mix(in srgb, var(--a) P%, var(--b))` and hex against a theme. */
function resolveValue(value: string, theme: Record<string, string>): string {
  const v = value.trim();
  if (v.startsWith('#')) return toHex(v)!;
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  if (ref) return resolveValue((own[ref[1]!] ?? theme[ref[1]!])!, theme);
  const mix = /^color-mix\(in srgb, var\((--[\w-]+)\) (\d+)%, var\((--[\w-]+)\)\)$/.exec(v);
  if (mix) {
    const a = rgb(resolveValue(`var(${mix[1]})`, theme));
    const b = rgb(resolveValue(`var(${mix[3]})`, theme));
    const p = Number(mix[2]) / 100;
    return toHex(`rgb(${a.map((c, i) => c * p + b[i]! * (1 - p)).join(', ')})`)!;
  }
  throw new Error(`cannot resolve ${v}`);
}

const VARS = [...Object.values(KIND_VAR), ...AGE_VAR];

describe('treemap palette (tokens only)', () => {
  it('defines every file type and age bucket and holds no hex value of its own', () => {
    for (const name of VARS) expect(own[name], name).toBeDefined();
    expect(Object.keys(KIND_VAR).sort()).toEqual([...FILE_KINDS].sort());
    expect(palette).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    // `[data-hue]` rebinds --viz-1 and --module-color inside every module: the map would follow the module hue.
    expect(palette).not.toMatch(/var\(--(viz-1|module-color)\)/);
  });

  it('maps the file types onto the module hues as agreed', () => {
    expect(own['--k-video']).toBe('var(--mod-ocean)');
    expect(own['--k-image']).toBe('var(--mod-fern)');
    expect(own['--k-audio']).toBe('var(--mod-violet)');
    expect(own['--k-archive']).toBe('var(--mod-lime)');
    expect(own['--k-program']).toBe('var(--mod-orchid)');
    expect(own['--k-document']).toBe('var(--mod-teal)');
    expect(own['--k-game']).toBe('var(--mod-indigo)');
    expect(own['--k-other']).toBe('var(--mod-slate)');
  });

  for (const [name, theme] of Object.entries(themes))
    it(`every colour reaches 3:1 on --surface (${name})`, () => {
      const surface = resolveValue('var(--surface)', theme);
      for (const v of VARS) {
        const c = resolveValue(`var(${v})`, theme);
        expect(ratio(c, surface), `${v} ${c} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    });

  for (const [name, theme] of Object.entries(themes))
    it(`file types stay distinct from each other (${name})`, () => {
      const seen = new Set(Object.values(KIND_VAR).map((v) => resolveValue(`var(${v})`, theme)));
      expect(seen.size).toBe(Object.keys(KIND_VAR).length);
      const ages = new Set(AGE_VAR.map((v) => resolveValue(`var(${v})`, theme)));
      expect(ages.size).toBe(AGE_VAR.length);
    });
});

describe('toHex', () => {
  it('reads the forms a browser computes', () => {
    expect(toHex('rgb(22, 132, 127)')).toBe('#16847f');
    expect(toHex('rgba(22, 132, 127, 0.5)')).toBe('#16847f');
    expect(toHex('rgb(22 132 127)')).toBe('#16847f');
    expect(toHex('color(srgb 1 0.5 0)')).toBe('#ff8000');
    expect(toHex('#abc')).toBe('#aabbcc');
    expect(toHex('#16847F')).toBe('#16847f');
    expect(toHex('var(--x)')).toBeNull();
  });
  it('feeds textOn with a plain colour', () => {
    expect(textOn(toHex('rgb(255, 255, 255)')!)).toBe('#111111');
    expect(textOn(toHex('color(srgb 0.1 0.1 0.1)')!)).toBe('#ffffff');
  });
});
