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

/** `fg` at `alpha` over `bg` (what `color-mix(fg alpha%, transparent)` looks like on that surface). */
const mix = (fg: string, bg: string, alpha: number): string => {
  const f = fg
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  const b = bg
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  return `#${f
    .map((c, i) =>
      Math.round(c * alpha + b[i]! * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
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
        for (const bg of ['--bg', '--surface', '--surface-2']) {
          text('--text', bg);
          text('--text-muted', bg);
          text('--text-3', bg);
        }
        text('--accent', '--surface');
        text('--accent', '--accent-soft');
        text('--text', '--accent-soft');
      });
      it('status colours on surfaces; their badge ink on the 15 % background over page, card and chip', () => {
        for (const s of ['--danger', '--success', '--warning', '--info']) {
          text(s, '--surface');
          text(s, '--bg');
          const ink = mix(t['--text']!, t[s]!, 0.15);
          for (const bg of ['--bg', '--surface', '--surface-2']) {
            const soft = mix(t[s]!, t[bg]!, 0.15);
            expect(ratio(ink, soft), `${s}-ink on ${s}-soft over ${bg}`).toBeGreaterThanOrEqual(
              4.5,
            );
          }
        }
      });
      it('page background and text on the filled accent', () => {
        text('--accent', '--bg');
        text('--accent-contrast', '--accent');
      });
      it('non-text UI (form borders, focus ring, chart series) reaches 3:1', () => {
        text('--border-strong', '--surface', 3);
        text('--border-strong', '--surface-2', 3); // switch off-track, controls on quiet areas
        text('--focus', '--bg', 3);
        text('--focus', '--surface', 3);
        text('--focus', '--surface-2', 3);
        text('--viz-1', '--surface', 3);
        text('--viz-2', '--surface', 3);
      });
    });
  }

  it('removed tokens stay removed; status backgrounds are mixes, not hex', () => {
    for (const key of ['--accent-2', '--accent-2-soft', '--surface-glass', '--focus-ring'])
      expect(light, key).not.toHaveProperty(key);
    for (const s of ['danger', 'success', 'warning', 'info']) {
      expect(light[`--${s}-soft`], `--${s}-soft`).toMatch(/^color-mix\(/);
      expect(light[`--${s}-ink`], `--${s}-ink`).toMatch(/^color-mix\(/);
    }
    expect(css).not.toMatch(/--accent-2/);
  });

  it('radii follow the spec (8 / 12 / 16 / 20)', () => {
    expect([
      light['--radius-sm'],
      light['--radius-md'],
      light['--radius-lg'],
      light['--radius-xl'],
    ]).toEqual(['8px', '12px', '16px', '20px']);
  });

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
        expect(
          ratio(pair('--accent-contrast')[i]!, pair('--accent')[i]!),
          `${label} button text`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
