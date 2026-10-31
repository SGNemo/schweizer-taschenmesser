/**
 * Draws one vector tile onto a 2D canvas context: areas, lines with casing, then labels with a halo and a
 * simple collision check. Overzoom (a tile shown deeper than its data) enlarges the right quarter of the
 * data tile. No DOM here: the context is passed in, so the renderer is unit-tested with a recording fake.
 */
import { EXTENT, type TileFeature, type VectorTile } from './mvt';
import {
  STYLES,
  styleKeyOf,
  widthAt,
  type FillStyle,
  type LineStyle,
  type Palette,
  type PointStyle,
  type Style,
} from './style';

/** The slice of CanvasRenderingContext2D (also OffscreenCanvasRenderingContext2D) the renderer uses. */
export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  setLineDash(segments: number[]): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  rect(x: number, y: number, w: number, h: number): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  clip(): void;
  fill(rule?: CanvasFillRule): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  save(): void;
  restore(): void;
}

export interface RenderInput {
  tile: VectorTile;
  /** Zoom the tile data was cut at. */
  dataZoom: number;
  /** Zoom to draw at; above `dataZoom` the data tile is enlarged (overzoom). */
  zoom: number;
  /** Which part of the data tile this drawn tile shows (0..2^(zoom-dataZoom)-1 each). */
  sub: { x: number; y: number };
  /** CSS pixel size of the drawn tile and the device pixel ratio. */
  size: number;
  dpr: number;
}

export interface RenderStats {
  features: number;
  labels: number;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

const LABEL_PAD = 2;

export function renderTile(ctx: Ctx2D, input: RenderInput, palette: Palette): RenderStats {
  const px = input.size * input.dpr;
  const dz = Math.max(0, input.zoom - input.dataZoom);
  const parts = 2 ** dz;
  const stats: RenderStats = { features: 0, labels: 0 };
  const placed: Box[] = [];

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, px, px);
  ctx.clip();
  ctx.fillStyle = palette.colors.land;
  ctx.fillRect(0, 0, px, px);

  // Group features by style key, in the table's draw order.
  const groups = new Map<string, { f: TileFeature; k: number; ox: number; oy: number }[]>();
  for (const layer of input.tile.layers) {
    const extent = layer.extent ?? EXTENT;
    const k = (px * parts) / extent;
    const ox = (input.sub.x * extent) / parts;
    const oy = (input.sub.y * extent) / parts;
    for (const f of layer.features) {
      const cls = typeof f.tags.class === 'string' ? f.tags.class : undefined;
      const key = styleKeyOf(layer.name, cls);
      if (!key) continue;
      const list = groups.get(key) ?? [];
      list.push({ f, k, ox, oy });
      groups.set(key, list);
    }
  }

  const tx = (v: number, o: number, k: number) => (v - o) * k;
  const path = (f: TileFeature, k: number, ox: number, oy: number, close: boolean) => {
    for (const part of f.geometry) {
      part.forEach((p, i) => {
        const x = tx(p[0]!, ox, k);
        const y = tx(p[1]!, oy, k);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      if (close) ctx.closePath();
    }
  };

  const labels: { f: TileFeature; style: Style; k: number; ox: number; oy: number }[] = [];

  for (const [key, style] of STYLES) {
    const list = groups.get(key);
    if (!list || input.zoom < style.minZoom) continue;
    if (style.kind === 'fill') {
      drawFills(ctx, list, style, input, palette, path);
      stats.features += list.length;
    } else if (style.kind === 'line') {
      drawLines(ctx, list, style, input, palette, path);
      stats.features += list.length;
      if (style.labelZoom !== undefined && input.zoom >= style.labelZoom)
        for (const e of list) if (typeof e.f.tags.name === 'string') labels.push({ ...e, style });
    } else {
      for (const e of list) labels.push({ ...e, style });
    }
  }

  // Labels last, points before road names, so a place name never loses against a street.
  ctx.textBaseline = 'middle';
  for (const kind of ['point', 'line'] as const) {
    for (const e of labels) {
      if (e.style.kind !== kind) continue;
      const name = typeof e.f.tags.name === 'string' ? e.f.tags.name : '';
      if (!name) continue;
      const drawn =
        e.style.kind === 'point'
          ? drawPointLabel(ctx, e.f, e.style, name, e.k, e.ox, e.oy, input, palette, placed)
          : drawLineLabel(ctx, e.f, name, e.k, e.ox, e.oy, input, palette, placed);
      if (drawn) stats.labels++;
    }
  }

  ctx.restore();
  return stats;
}

function drawFills(
  ctx: Ctx2D,
  list: { f: TileFeature; k: number; ox: number; oy: number }[],
  style: FillStyle,
  input: RenderInput,
  palette: Palette,
  path: (f: TileFeature, k: number, ox: number, oy: number, close: boolean) => void,
): void {
  ctx.fillStyle = palette.colors[style.color];
  const outline = style.line && input.zoom >= style.line.minZoom ? style.line : undefined;
  if (outline) {
    ctx.strokeStyle = palette.colors[outline.color];
    ctx.lineWidth = outline.width * input.dpr;
    ctx.setLineDash([]);
    ctx.lineJoin = 'round';
  }
  for (const e of list) {
    ctx.beginPath();
    path(e.f, e.k, e.ox, e.oy, true);
    ctx.fill('nonzero');
    if (outline) ctx.stroke();
  }
}

function drawLines(
  ctx: Ctx2D,
  list: { f: TileFeature; k: number; ox: number; oy: number }[],
  style: LineStyle,
  input: RenderInput,
  palette: Palette,
  path: (f: TileFeature, k: number, ox: number, oy: number, close: boolean) => void,
): void {
  const width = widthAt(style.width, input.zoom) * input.dpr;
  ctx.lineCap = style.dash ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  const passes: { color: string; width: number; dash: number[] }[] = [];
  if (style.casing)
    passes.push({
      color: palette.colors[style.casing.color],
      width: width + style.casing.extra * input.dpr,
      dash: [],
    });
  passes.push({
    color: palette.colors[style.color],
    width,
    dash: (style.dash ?? []).map((d) => d * input.dpr),
  });
  for (const pass of passes) {
    ctx.strokeStyle = pass.color;
    ctx.lineWidth = pass.width;
    ctx.setLineDash(pass.dash);
    ctx.beginPath();
    for (const e of list) path(e.f, e.k, e.ox, e.oy, false);
    ctx.stroke();
  }
}

function text(
  ctx: Ctx2D,
  style: PointStyle | { size: number; bold?: boolean },
  palette: Palette,
  dpr: number,
) {
  ctx.font = `${style.bold ? '600 ' : ''}${Math.round(style.size * dpr)}px ${palette.fontFamily}`;
}

function haloText(ctx: Ctx2D, name: string, x: number, y: number, palette: Palette, dpr: number) {
  ctx.lineWidth = 3 * dpr;
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.strokeStyle = palette.colors.textHalo;
  ctx.strokeText(name, x, y);
  ctx.fillText(name, x, y);
}

function drawPointLabel(
  ctx: Ctx2D,
  f: TileFeature,
  style: PointStyle,
  name: string,
  k: number,
  ox: number,
  oy: number,
  input: RenderInput,
  palette: Palette,
  placed: Box[],
): boolean {
  const p = f.geometry[0]?.[0];
  if (!p) return false;
  const x = (p[0]! - ox) * k;
  const y = (p[1]! - oy) * k;
  const px = input.size * input.dpr;
  if (x < 0 || y < 0 || x > px || y > px) return false;
  text(ctx, style, palette, input.dpr);
  const w = ctx.measureText(name).width;
  const h = style.size * input.dpr;
  const dot = style.dot ? 3 * input.dpr : 0;
  const box: Box = style.dot
    ? {
        x0: x - dot - LABEL_PAD,
        y0: y - h / 2 - LABEL_PAD,
        x1: x + dot * 2 + w + LABEL_PAD,
        y1: y + h / 2 + LABEL_PAD,
      }
    : {
        x0: x - w / 2 - LABEL_PAD,
        y0: y - h / 2 - LABEL_PAD,
        x1: x + w / 2 + LABEL_PAD,
        y1: y + h / 2 + LABEL_PAD,
      };
  if (placed.some((b) => overlaps(b, box))) return false;
  placed.push(box);
  ctx.fillStyle = palette.colors[style.color];
  if (style.dot) {
    ctx.beginPath();
    ctx.arc(x, y, dot, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    haloText(ctx, name, x + dot * 2, y, palette, input.dpr);
  } else {
    ctx.textAlign = 'center';
    haloText(ctx, name, x, y, palette, input.dpr);
  }
  return true;
}

/** A street name, horizontal, in the middle of the longest segment that has room for it. */
function drawLineLabel(
  ctx: Ctx2D,
  f: TileFeature,
  name: string,
  k: number,
  ox: number,
  oy: number,
  input: RenderInput,
  palette: Palette,
  placed: Box[],
): boolean {
  const style = { size: 10 };
  text(ctx, style, palette, input.dpr);
  const w = ctx.measureText(name).width;
  const h = style.size * input.dpr;
  const px = input.size * input.dpr;
  let best: { x: number; y: number; len: number } | undefined;
  for (const part of f.geometry) {
    for (let i = 0; i + 1 < part.length; i++) {
      // Only the part of the segment inside this drawn tile counts (a long street, or an overzoomed
      // parent tile, would otherwise put its one label into a neighbour).
      const seg = clipToSquare(
        (part[i]![0]! - ox) * k,
        (part[i]![1]! - oy) * k,
        (part[i + 1]![0]! - ox) * k,
        (part[i + 1]![1]! - oy) * k,
        px,
      );
      if (!seg) continue;
      const [ax, ay, bx, by] = seg;
      const len = Math.hypot(bx - ax, by - ay);
      if (!best || len > best.len) best = { x: (ax + bx) / 2, y: (ay + by) / 2, len };
    }
  }
  if (!best || best.len < w + 8 * input.dpr) return false;
  if (best.x - w / 2 < 0 || best.x + w / 2 > px || best.y < 0 || best.y > px) return false;
  const box: Box = {
    x0: best.x - w / 2 - LABEL_PAD,
    y0: best.y - h / 2 - LABEL_PAD,
    x1: best.x + w / 2 + LABEL_PAD,
    y1: best.y + h / 2 + LABEL_PAD,
  };
  if (placed.some((b) => overlaps(b, box))) return false;
  placed.push(box);
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.colors.text;
  haloText(ctx, name, best.x, best.y, palette, input.dpr);
  return true;
}

/** Liang–Barsky against the square 0..size; undefined when the segment misses it. */
function clipToSquare(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  size: number,
): [number, number, number, number] | undefined {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (const [p, q] of [
    [-dx, ax],
    [dx, size - ax],
    [-dy, ay],
    [dy, size - ay],
  ] as const) {
    if (p === 0) {
      if (q < 0) return undefined;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return undefined;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return undefined;
      if (r < t1) t1 = r;
    }
  }
  return [ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1];
}
