import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');

/** Declarations of the first block that follows `header` (custom properties only). */
function block(header: string): Record<string, string> {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`block not found: ${header}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+|color-scheme):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim().replace(/\s+/g, ' ');
  return out;
}

const light = { ...block(':root {\n  --font-sans') } as Record<string, string>;
const dark = block(":root[data-theme='dark']");
const darkMedia = block(":root:not([data-theme='light'])");

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

describe('design tokens', () => {
  it('the dark palette is defined twice (explicit + system) and both copies are identical', () => {
    expect(Object.keys(dark).length).toBeGreaterThan(20);
    expect(darkMedia).toEqual(dark);
  });

  it('every semantic colour exists in both themes', () => {
    for (const key of Object.keys(dark).filter((k) => k.startsWith('--')))
      expect(light, `${key} missing in light`).toHaveProperty(key);
  });

  const themes = { light, dark } as const;
  for (const [name, t] of Object.entries(themes)) {
    describe(`${name}: WCAG AA`, () => {
      const text = (fg: string, bg: string, min = 4.5) =>
        expect(ratio(t[fg]!, t[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
      it('text on backgrounds and surfaces', () => {
        text('--text', '--surface');
        text('--text', '--surface-2');
        text('--text-muted', '--surface');
        text('--text-muted', '--surface-2');
        text('--accent', '--surface');
        text('--accent', '--accent-soft');
        text('--danger', '--surface');
        text('--danger', '--danger-soft');
        text('--success', '--surface');
        text('--success', '--success-soft');
        text('--warning', '--surface');
        text('--warning', '--warning-soft');
        text('--accent-2', '--surface');
      });
      it('page background (both gradient ends) and button text', () => {
        const ends = t['--bg-gradient']!.match(/#[0-9a-f]{6}/g)!;
        for (const end of ends) {
          expect(ratio(t['--text']!, end)).toBeGreaterThanOrEqual(4.5);
          expect(ratio(t['--text-muted']!, end)).toBeGreaterThanOrEqual(4.5);
          expect(ratio(t['--accent']!, end)).toBeGreaterThanOrEqual(4.5);
        }
        text('--accent-contrast', '--accent-grad-from');
        text('--accent-contrast', '--accent-grad-to');
      });
      it('non-text UI (form borders, focus ring, chart series) reaches 3:1', () => {
        text('--border-strong', '--surface', 3);
        text('--focus', '--surface', 3);
        text('--viz-1', '--surface', 3);
        text('--viz-2', '--surface', 3);
      });
    });
  }

  it('accent variants keep AA for every (light, dark) pair', () => {
    const surface = { light: light['--surface']!, dark: dark['--surface']! };
    for (const accent of ['teal', 'coral', 'lagoon']) {
      const b = block(`:root[data-accent='${accent}']`);
      const pair = (key: string): [string, string] => {
        const m = b[key]!.match(/light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/)!;
        return [m[1]!, m[2]!];
      };
      for (const [i, scheme] of (['light', 'dark'] as const).entries()) {
        const s = surface[scheme];
        const label = `${accent}/${scheme}`;
        expect(ratio(pair('--accent')[i]!, s), `${label} accent text`).toBeGreaterThanOrEqual(4.5);
        expect(
          ratio(pair('--accent')[i]!, pair('--accent-soft')[i]!),
          `${label} on soft`,
        ).toBeGreaterThanOrEqual(4.5);
        for (const end of ['--accent-grad-from', '--accent-grad-to'])
          expect(
            ratio(pair('--accent-contrast')[i]!, pair(end)[i]!),
            `${label} ${end}`,
          ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
