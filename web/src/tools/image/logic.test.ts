import { describe, expect, it } from 'vitest';
import { cropRect, fitSize, humanSize, outName } from './logic';

describe('fitSize', () => {
  it('keeps the aspect ratio and never enlarges', () => {
    expect(fitSize(4000, 3000, 1000)).toEqual({ w: 1000, h: 750 });
    expect(fitSize(3000, 4000, 1000)).toEqual({ w: 750, h: 1000 });
    expect(fitSize(800, 600, 1000)).toEqual({ w: 800, h: 600 });
    expect(fitSize(800, 600, undefined)).toEqual({ w: 800, h: 600 });
    expect(fitSize(800, 600, 0)).toEqual({ w: 800, h: 600 });
    expect(fitSize(10_000, 1, 100)).toEqual({ w: 100, h: 1 });
  });
});

describe('cropRect', () => {
  it('crops the centre to the ratio', () => {
    expect(cropRect(400, 300, 'none')).toEqual({ x: 0, y: 0, w: 400, h: 300 });
    expect(cropRect(400, 300, '1:1')).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    expect(cropRect(300, 400, '1:1')).toEqual({ x: 0, y: 50, w: 300, h: 300 });
    expect(cropRect(1600, 900, '4:3')).toEqual({ x: 200, y: 0, w: 1200, h: 900 });
    expect(cropRect(400, 300, '16:9')).toEqual({ x: 0, y: 37, w: 400, h: 225 });
    expect(cropRect(400, 300, '9:16')).toEqual({ x: 115, y: 0, w: 169, h: 300 });
  });
  it('stays inside the picture', () => {
    for (const [w, h] of [
      [1, 1],
      [7, 3],
      [1000, 3],
      [3, 1000],
    ] as const)
      for (const r of ['1:1', '4:3', '3:2', '16:9', '3:4', '2:3', '9:16'] as const) {
        const c = cropRect(w, h, r);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(w);
        expect(c.y + c.h).toBeLessThanOrEqual(h);
        expect(c.w).toBeGreaterThanOrEqual(1);
      }
  });
});

describe('outName and humanSize', () => {
  it('replaces the extension', () => {
    expect(outName('Urlaub.HEIC', 'image/webp')).toBe('Urlaub-klein.webp');
    expect(outName('a.b.png', 'image/jpeg')).toBe('a.b-klein.jpg');
    expect(outName('ohne', 'image/png')).toBe('ohne-klein.png');
    expect(outName('.png', 'image/png')).toBe('bild-klein.png');
  });
  it('formats sizes', () => {
    expect(humanSize(999)).toBe('999 B');
    expect(humanSize(1536)).toBe('1,5 KB');
    expect(humanSize(5 * 1024 * 1024)).toBe('5 MB');
  });
});
