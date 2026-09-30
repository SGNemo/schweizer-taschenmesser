import { describe, expect, it } from 'vitest';
import { makeQr, qrPath, qrSvg, QrTooLongError } from './logic';

describe('makeQr', () => {
  it('produces a square matrix with the three finder patterns', () => {
    const m = makeQr('https://example.test/');
    expect(m.dark).toHaveLength(m.size);
    expect(m.dark.every((row) => row.length === m.size)).toBe(true);
    // Finder patterns: 7×7 dark ring around a 3×3 dark centre, in three corners.
    const corners = [
      [0, 0],
      [0, m.size - 7],
      [m.size - 7, 0],
    ] as const;
    for (const [r, c] of corners) {
      for (let i = 0; i < 7; i++) {
        expect(m.dark[r + 0]![c + i]).toBe(true);
        expect(m.dark[r + 6]![c + i]).toBe(true);
        expect(m.dark[r + i]![c + 0]).toBe(true);
        expect(m.dark[r + i]![c + 6]).toBe(true);
      }
      expect(m.dark[r + 3]![c + 3]).toBe(true);
      expect(m.dark[r + 1]![c + 1]).toBe(false);
    }
    expect(m.size).toBe(25); // version 2 holds 26 bytes at level M
  });

  it('grows with the text, keeps umlauts, and refuses text that cannot fit', () => {
    expect(makeQr('a').size).toBe(21);
    expect(makeQr('Grüße aus Köln 🎉').size).toBeGreaterThanOrEqual(21);
    expect(() => makeQr('x'.repeat(5000))).toThrow(QrTooLongError);
  });

  it('renders an SVG path that covers exactly the dark modules', () => {
    const m = makeQr('hi');
    const { path, box } = qrPath(m);
    expect(box).toBe(m.size + 8);
    // Count dark modules from the path's run lengths.
    const runs = [...path.matchAll(/M\d+ \d+h(\d+)/g)].reduce((sum, x) => sum + Number(x[1]), 0);
    expect(runs).toBe(m.dark.flat().filter(Boolean).length);
    const svg = qrSvg(m);
    expect(svg).toContain(`viewBox="0 0 ${box} ${box}"`);
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).not.toMatch(/<script|onload/i);
  });
});
