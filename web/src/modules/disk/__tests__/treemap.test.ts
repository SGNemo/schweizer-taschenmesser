import { describe, expect, it } from 'vitest';
import {
  contains,
  hitTest,
  layoutTree,
  squarify,
  type LayoutNode,
  type Rect,
} from '../logic/treemap';

const area = (r: Rect) => r.w * r.h;
const B: Rect = { x: 0, y: 0, w: 600, h: 400 };

describe('squarify', () => {
  it('gives every item an area proportional to its value and fills the bounds', () => {
    const items = [6, 6, 4, 3, 2, 2, 1].map((value, id) => ({ id, value }));
    const tiles = squarify(items, B);
    expect(tiles).toHaveLength(items.length);
    const total = items.reduce((s, i) => s + i.value, 0);
    for (const t of tiles) expect(area(t.rect)).toBeCloseTo((t.item.value / total) * area(B), 6);
    expect(tiles.reduce((s, t) => s + area(t.rect), 0)).toBeCloseTo(area(B), 6);
  });

  it('keeps every tile inside the bounds and without overlap', () => {
    const items = Array.from({ length: 40 }, (_, id) => ({ id, value: 1 + ((id * 37) % 23) }));
    const tiles = squarify(items, B);
    for (const { rect: r } of tiles) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.y).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(B.w + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(B.h + 1e-6);
    }
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i]!.rect;
        const b = tiles[j]!.rect;
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(overlapX > 1e-6 && overlapY > 1e-6).toBe(false);
      }
  });

  it('puts the biggest item first and keeps aspect ratios reasonable', () => {
    const tiles = squarify(
      [1, 9, 3, 3, 2].map((value, id) => ({ id, value })),
      B,
    );
    expect(tiles[0]!.item.value).toBe(9);
    for (const { rect: r } of tiles) expect(Math.max(r.w / r.h, r.h / r.w)).toBeLessThan(4);
  });

  it('drops zero, negative and non-finite values and survives empty input', () => {
    expect(squarify([], B)).toEqual([]);
    expect(
      squarify(
        [
          { id: 1, value: 0 },
          { id: 2, value: -5 },
          { id: 3, value: NaN },
          { id: 4, value: Infinity },
        ],
        B,
      ),
    ).toEqual([]);
    expect(squarify([{ id: 1, value: 5 }], B)[0]!.rect).toEqual(B);
  });

  it('returns nothing for a degenerate area', () => {
    expect(squarify([{ id: 1, value: 1 }], { x: 0, y: 0, w: 0, h: 100 })).toEqual([]);
    expect(squarify([{ id: 1, value: 1 }], { x: 0, y: 0, w: 100, h: NaN })).toEqual([]);
  });

  it('works with a single very dominant item next to tiny ones', () => {
    const tiles = squarify(
      [1_000_000, 1, 1, 1].map((value, id) => ({ id, value })),
      B,
    );
    expect(tiles).toHaveLength(4);
    expect(area(tiles[0]!.rect)).toBeGreaterThan(0.999 * area(B));
  });
});

describe('layoutTree and hitTest', () => {
  // 0 (root) -> 1 (dir, 60) -> 3 (file, 40), 4 (file, 20); 2 (file, 40)
  const kids: Record<number, LayoutNode[]> = {
    0: [
      { id: 1, value: 60, isDir: true },
      { id: 2, value: 40, isDir: false },
    ],
    1: [
      { id: 3, value: 40, isDir: false },
      { id: 4, value: 20, isDir: false },
    ],
  };
  const childrenOf = (id: number) => kids[id] ?? [];

  it('nests the children of a big folder tile inside it, after the parent (draw order)', () => {
    const tiles = layoutTree(0, childrenOf, { x: 0, y: 0, w: 400, h: 300 });
    expect(tiles.map((t) => t.id)).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    const order = tiles.map((t) => t.id);
    expect(order.indexOf(1)).toBeLessThan(order.indexOf(3));
    const parent = tiles.find((t) => t.id === 1)!;
    expect(parent.open).toBe(true);
    for (const id of [3, 4]) {
      const c = tiles.find((t) => t.id === id)!;
      expect(c.depth).toBe(1);
      expect(c.rect.x).toBeGreaterThanOrEqual(parent.rect.x);
      expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(parent.rect.x + parent.rect.w + 1e-6);
      expect(c.rect.y).toBeGreaterThanOrEqual(parent.rect.y + 16 - 1e-6);
    }
  });

  it('does not nest when maxDepth is 1 and skips tiles that are too small', () => {
    const flat = layoutTree(
      0,
      childrenOf,
      { x: 0, y: 0, w: 400, h: 300 },
      {
        maxDepth: 1,
        minSide: 3,
        nestMin: 60,
        pad: 2,
        header: 16,
      },
    );
    expect(flat.map((t) => t.id).sort()).toEqual([1, 2]);
    const tiny = layoutTree(
      0,
      childrenOf,
      { x: 0, y: 0, w: 4, h: 4 },
      {
        maxDepth: 1,
        minSide: 3,
        nestMin: 60,
        pad: 2,
        header: 16,
      },
    );
    expect(tiny.length).toBeLessThan(2);
  });

  it('hit testing prefers the deepest tile', () => {
    const tiles = layoutTree(0, childrenOf, { x: 0, y: 0, w: 400, h: 300 });
    const leaf = tiles.find((t) => t.id === 3)!;
    const hit = hitTest(tiles, leaf.rect.x + 1, leaf.rect.y + 1);
    expect(hit?.id).toBe(3);
    const parent = tiles.find((t) => t.id === 1)!;
    expect(hitTest(tiles, parent.rect.x + 0.5, parent.rect.y + 0.5)?.id).toBe(1);
    expect(hitTest(tiles, -5, -5)).toBeUndefined();
    expect(contains({ x: 0, y: 0, w: 10, h: 10 }, 10, 5)).toBe(false);
  });
});
