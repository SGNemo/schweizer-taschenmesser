/**
 * Squarified treemap (Bruls, Huizing, van Wijk): tiles with an aspect ratio as close to 1 as
 * possible, so small entries stay visible and clickable. Pure functions, no DOM.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Tile<T> {
  item: T;
  rect: Rect;
}

/** Worst aspect ratio of a row of areas laid along a side of length `side`. */
function worst(areas: number[], sum: number, side: number): number {
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const s2 = side * side;
  return Math.max((s2 * max) / (sum * sum), (sum * sum) / (s2 * min));
}

/**
 * Lays `items` out inside `bounds`; the area of every tile is proportional to `value`.
 * Items with a non-positive or non-finite value are dropped; an empty result comes back for an
 * empty or degenerate `bounds`. Output order: biggest first.
 */
export function squarify<T extends { value: number }>(
  items: readonly T[],
  bounds: Rect,
): Tile<T>[] {
  const out: Tile<T>[] = [];
  const list = items.filter((i) => Number.isFinite(i.value) && i.value > 0);
  if (!list.length || !(bounds.w > 0) || !(bounds.h > 0)) return out;
  list.sort((a, b) => b.value - a.value);
  const total = list.reduce((s, i) => s + i.value, 0);
  const scale = (bounds.w * bounds.h) / total;
  let { x, y, w, h } = bounds;
  let i = 0;
  while (i < list.length) {
    const side = Math.min(w, h);
    const row: T[] = [];
    let areas: number[] = [];
    let sum = 0;
    // Grow the row while the worst aspect ratio does not get worse.
    while (i < list.length) {
      const a = list[i]!.value * scale;
      const next = [...areas, a];
      if (areas.length && worst(next, sum + a, side) > worst(areas, sum, side)) break;
      row.push(list[i]!);
      areas = next;
      sum += a;
      i++;
    }
    if (w >= h) {
      // Column on the left, tiles stacked vertically.
      const cw = sum / h;
      let cy = y;
      row.forEach((item, k) => {
        const th = areas[k]! / cw;
        out.push({ item, rect: { x, y: cy, w: cw, h: th } });
        cy += th;
      });
      x += cw;
      w -= cw;
    } else {
      const rh = sum / w;
      let cx = x;
      row.forEach((item, k) => {
        const tw = areas[k]! / rh;
        out.push({ item, rect: { x: cx, y, w: tw, h: rh } });
        cx += tw;
      });
      y += rh;
      h -= rh;
    }
  }
  return out;
}

export const inset = (r: Rect, pad: number, top = pad): Rect => ({
  x: r.x + pad,
  y: r.y + top,
  w: Math.max(0, r.w - 2 * pad),
  h: Math.max(0, r.h - top - pad),
});

export const contains = (r: Rect, px: number, py: number): boolean =>
  px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

export interface LayoutNode {
  id: number;
  value: number;
  /** Folders can be entered; files and aggregates are leaves. */
  isDir: boolean;
}

export interface LaidOut {
  id: number;
  parentId: number;
  depth: number;
  rect: Rect;
  isDir: boolean;
  /** The inner area of a folder tile that is shown open (its children are laid out inside). */
  open: boolean;
}

export interface LayoutOptions {
  /** How many folder levels are drawn inside each other (1 = only the direct children). */
  maxDepth: number;
  /** Tiles with a side shorter than this are not drawn. */
  minSide: number;
  /** Folder tiles at least this big get a padding + header so children can nest. */
  nestMin: number;
  pad: number;
  header: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = {
  maxDepth: 2,
  minSide: 3,
  nestMin: 60,
  pad: 2,
  header: 16,
};

/**
 * Recursive layout below `rootId`. `childrenOf` returns the entries of a folder; the result is in
 * draw order (parents before their children), so hit testing walks it backwards.
 */
export function layoutTree(
  rootId: number,
  childrenOf: (id: number) => readonly LayoutNode[],
  bounds: Rect,
  opts: LayoutOptions = DEFAULT_LAYOUT,
): LaidOut[] {
  const out: LaidOut[] = [];
  const place = (parentId: number, rect: Rect, depth: number) => {
    const tiles = squarify(
      childrenOf(parentId).map((n) => ({ ...n })),
      rect,
    );
    for (const { item, rect: r } of tiles) {
      if (r.w < opts.minSide || r.h < opts.minSide) continue;
      const canNest =
        item.isDir && depth + 1 < opts.maxDepth && r.w >= opts.nestMin && r.h >= opts.nestMin;
      out.push({ id: item.id, parentId, depth, rect: r, isDir: item.isDir, open: canNest });
      if (canNest) place(item.id, inset(r, opts.pad, opts.header), depth + 1);
    }
  };
  place(rootId, bounds, 0);
  return out;
}

/** Topmost tile under a point (the deepest one, since children are drawn after their parent). */
export function hitTest(tiles: readonly LaidOut[], px: number, py: number): LaidOut | undefined {
  for (let i = tiles.length - 1; i >= 0; i--) {
    if (contains(tiles[i]!.rect, px, py)) return tiles[i];
  }
  return undefined;
}
