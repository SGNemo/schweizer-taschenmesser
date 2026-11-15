/**
 * Colour guards of the shared charts: every share slot keeps 3:1 on the card for every module hue in both themes
 * (WCAG 1.4.11), and "Ruhig" greys the series inside the chart frame. Reads the hex values from `ui/tokens.css`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..', '..');
const tokens = readFileSync(resolve(SRC, 'ui/tokens.css'), 'utf8');
const chartCss = readFileSync(resolve(SRC, 'ui/charts/charts.module.css'), 'utf8');

/** Custom properties of the first block that starts with `header`. */
function block(header: string): Record<string, string> {
  const open = tokens.indexOf('{', tokens.indexOf(header));
  const close = tokens.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of tokens.slice(open + 1, close).matchAll(/(--[\w-]+):\s*([^;]+);/g))
    out[m[1]!] = m[2]!.trim();
  return out;
}

const rgb = (hex: string) =>
  hex
    .replace('#', '')
    .match(/../g)!
    .map((h) => parseInt(h, 16));
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex)
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
/** `color-mix(in srgb, a share, b)`. */
const mix = (a: string, b: string, share: number) => {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x
    .map((c, i) =>
      Math.round(c * share + y[i]! * (1 - share))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

const themes = { light: block(':root {\n  --font-sans'), dark: block(":root[data-theme='dark']") };

describe('chart colours', () => {
  it('every share slot keeps 3:1 on the card for every module hue, both themes', () => {
    const steps = [
      ...chartCss.matchAll(/--c: color-mix\(in srgb, var\(--viz-1\) (\d+)%, var\(--text\)\)/g),
    ].map((m) => Number(m[1]) / 100);
    expect(steps).toHaveLength(5);
    for (const [name, t] of Object.entries(themes)) {
      const hues = [
        t['--viz-1']!,
        t['--calm-ink']!,
        ...Object.keys(t)
          .filter((k) => k.startsWith('--mod-') && k !== '--mod-slate')
          .map((k) => t[k]!),
      ];
      expect(
        hues.every((h) => /^#[0-9a-f]{6}$/i.test(h)),
        name,
      ).toBe(true);
      for (const hue of hues)
        for (const share of [1, ...steps])
          for (const surface of [t['--surface']!, t['--surface-raised']!])
            expect(
              ratio(mix(hue, t['--text']!, share), surface),
              `${name} ${hue} ${share}`,
            ).toBeGreaterThanOrEqual(3);
    }
  });

  it('"Ruhig" greys the series inside the chart frame only (older charts keep theirs)', () => {
    const calm = chartCss.slice(chartCss.indexOf(":global(:root[data-color='calm']) .frame"));
    expect(calm.slice(0, calm.indexOf('}'))).toMatch(
      /--viz-1: var\(--calm-ink\);\s*--viz-2: var\(--calm-ink\);/,
    );
    expect(tokens).not.toMatch(/--viz-2: var\(--calm-ink\)/);
  });
});
