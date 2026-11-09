import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packedRows } from './masonry';

describe('packed overview grid (U19/U39)', () => {
  it('spans a card over its own height plus the gap below, in 1 px rows', () => {
    expect(packedRows(200, 24)).toBe(224);
    expect(packedRows(312.4, 24)).toBe(337);
    expect(packedRows(0, 0)).toBe(1);
  });

  it('packs from two columns on, densely, and lets an empty card drop the size class minimum', () => {
    const css = readFileSync(join(__dirname, 'Home.module.css'), 'utf8');
    expect(css).toMatch(/\.grid\s*\{[^}]*grid-auto-flow: row dense/);
    expect(css).toMatch(/\.grid\[data-packed\]\s*\{[^}]*grid-auto-rows: 1px;[^}]*row-gap: 0/);
    expect(css).toMatch(/\.grid\[data-packed\] > \.widget\s*\{[^}]*grid-row: span var\(--rows/);
    expect(css).toMatch(/\.widget\[data-empty\]\s*\{[^}]*min-height: 0/);
  });
});
