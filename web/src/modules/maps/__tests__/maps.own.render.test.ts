import { describe, expect, it } from 'vitest';
import { project } from '../logic';
import { decodeTile, type VectorTile } from '../own/mvt';
import { renderTile, type Ctx2D, type RenderInput } from '../own/render';
import { SAMPLE_CENTER, sampleRegion } from '../own/sample';
import { fallbackPalette, styleOf, widthAt } from '../own/style';

/** Records every call; colours are the palette strings, so draw order can be asserted. */
class FakeCtx implements Ctx2D {
  calls: { op: string; args: unknown[]; fill: string; stroke: string; width: number }[] = [];
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  strokeStyle: string | CanvasGradient | CanvasPattern = '';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  font = '';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  private rec(op: string, ...args: unknown[]) {
    this.calls.push({
      op,
      args,
      fill: String(this.fillStyle),
      stroke: String(this.strokeStyle),
      width: this.lineWidth,
    });
  }
  setLineDash(s: number[]) {
    this.rec('setLineDash', s);
  }
  beginPath() {
    this.rec('beginPath');
  }
  moveTo(x: number, y: number) {
    this.rec('moveTo', x, y);
  }
  lineTo(x: number, y: number) {
    this.rec('lineTo', x, y);
  }
  closePath() {
    this.rec('closePath');
  }
  rect(x: number, y: number, w: number, h: number) {
    this.rec('rect', x, y, w, h);
  }
  arc(x: number, y: number, r: number) {
    this.rec('arc', x, y, r);
  }
  clip() {
    this.rec('clip');
  }
  fill(rule?: CanvasFillRule) {
    this.rec('fill', rule);
  }
  stroke() {
    this.rec('stroke');
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.rec('fillRect', x, y, w, h);
  }
  fillText(t: string, x: number, y: number) {
    this.rec('fillText', t, x, y);
  }
  strokeText(t: string, x: number, y: number) {
    this.rec('strokeText', t, x, y);
  }
  measureText(t: string) {
    return { width: t.length * 6 };
  }
  save() {
    this.rec('save');
  }
  restore() {
    this.rec('restore');
  }
}

const palette = (() => {
  const p = fallbackPalette();
  for (const k of Object.keys(p.colors) as (keyof typeof p.colors)[]) p.colors[k] = k;
  return p;
})();

const input = (tile: VectorTile, extra: Partial<RenderInput> = {}): RenderInput => ({
  tile,
  dataZoom: 14,
  zoom: 14,
  sub: { x: 0, y: 0 },
  size: 256,
  dpr: 1,
  ...extra,
});

const centre = project(SAMPLE_CENTER.lat, SAMPLE_CENTER.lon, 14);
const T14 = { x: Math.floor(centre.x / 256), y: Math.floor(centre.y / 256) };
const sampleTile14 = (): VectorTile => {
  const t = sampleRegion().tiles.find(
    (x) => x.data.z === 14 && x.data.x === T14.x && x.data.y === T14.y,
  );
  return decodeTile(new Uint8Array(t!.data.bytes));
};

describe('render', () => {
  it('draws land, areas, roads with casing and labels in that order', () => {
    const ctx = new FakeCtx();
    const stats = renderTile(ctx, input(sampleTile14()), palette);
    expect(stats.features).toBeGreaterThan(10);
    expect(stats.labels).toBeGreaterThanOrEqual(1);
    const ops = ctx.calls;
    expect(ops[0]!.op).toBe('save');
    const land = ops.findIndex((c) => c.op === 'fillRect' && c.fill === 'land');
    const park = ops.findIndex((c) => c.op === 'fill' && c.fill === 'park');
    const casing = ops.findIndex((c) => c.op === 'stroke' && c.stroke === 'roadMajorCasing');
    const road = ops.findIndex((c) => c.op === 'stroke' && c.stroke === 'roadMajor');
    const label = ops.findIndex((c) => c.op === 'fillText' && c.args[0] === 'Nemostadt');
    expect(land).toBeGreaterThanOrEqual(0);
    expect(park).toBeGreaterThan(land);
    expect(casing).toBeGreaterThan(park);
    expect(road).toBeGreaterThan(casing);
    expect(label).toBeGreaterThan(road);
    // The label has a halo drawn just before it.
    expect(ops[label - 1]).toMatchObject({ op: 'strokeText', stroke: 'textHalo' });
    expect(ops[ops.length - 1]!.op).toBe('restore');
    // Everything is clipped to the tile square.
    expect(ops.slice(0, 5).map((c) => c.op)).toEqual([
      'save',
      'beginPath',
      'rect',
      'clip',
      'fillRect',
    ]);
  });

  it('skips what is not drawn at the zoom (buildings below 14, POIs below 16)', () => {
    const tile = sampleTile14();
    const at13 = new FakeCtx();
    renderTile(at13, input(tile, { zoom: 13 }), palette);
    expect(at13.calls.some((c) => c.op === 'fill' && c.fill === 'building')).toBe(false);
    expect(at13.calls.some((c) => c.op === 'fillText' && c.args[0] === 'Apotheke')).toBe(false);
    const at16 = new FakeCtx();
    renderTile(at16, input(tile, { zoom: 16, sub: { x: 1, y: 1 } }), palette);
    expect(at16.calls.some((c) => c.op === 'fill' && c.fill === 'building')).toBe(true);
    expect(at16.calls.some((c) => c.op === 'stroke' && c.width > 4)).toBe(true);
  });

  it('overzoom enlarges the right quarter of the data tile', () => {
    const tile: VectorTile = {
      layers: [
        {
          name: 'place',
          features: [
            { type: 'point', geometry: [[[1536, 1536]]], tags: { class: 'town', name: 'X' } },
          ],
        },
      ],
    };
    const plain = new FakeCtx();
    renderTile(plain, input(tile), palette);
    expect(plain.calls.find((c) => c.op === 'fillText')!.args).toEqual(['X', 96, 96]);
    const deep = new FakeCtx();
    renderTile(deep, input(tile, { zoom: 16, sub: { x: 1, y: 1 } }), palette);
    expect(deep.calls.find((c) => c.op === 'fillText')!.args).toEqual(['X', 128, 128]);
    const other = new FakeCtx();
    renderTile(other, input(tile, { zoom: 16, sub: { x: 0, y: 0 } }), palette);
    expect(other.calls.some((c) => c.op === 'fillText')).toBe(false);
  });

  it('never draws two labels on top of each other, and scales text with the pixel ratio', () => {
    const tile: VectorTile = {
      layers: [
        {
          name: 'place',
          features: [
            { type: 'point', geometry: [[[2000, 2000]]], tags: { class: 'town', name: 'Eins' } },
            { type: 'point', geometry: [[[2010, 2005]]], tags: { class: 'village', name: 'Zwei' } },
            { type: 'point', geometry: [[[2000, 3000]]], tags: { class: 'suburb', name: 'Drei' } },
          ],
        },
      ],
    };
    const ctx = new FakeCtx();
    const stats = renderTile(ctx, input(tile, { dpr: 2 }), palette);
    expect(stats.labels).toBe(2);
    const texts = ctx.calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]);
    expect(texts).toEqual(['Eins', 'Drei']);
    expect(ctx.font).toMatch(/^(600 )?2\dpx sans-serif$/);
    expect(ctx.calls.find((c) => c.op === 'fillRect')!.args).toEqual([0, 0, 512, 512]);
  });

  it('street names appear on a long enough segment from zoom 16', () => {
    const tile: VectorTile = {
      layers: [
        {
          name: 'road',
          features: [
            {
              type: 'line',
              geometry: [
                [
                  [0, 1536],
                  [4096, 1536],
                ],
              ],
              tags: { class: 'residential', name: 'Amselweg' },
            },
            {
              type: 'line',
              geometry: [
                [
                  [100, 100],
                  [140, 100],
                ],
              ],
              tags: { class: 'residential', name: 'Ein viel zu langer Name für ein kurzes Stück' },
            },
          ],
        },
      ],
    };
    const low = new FakeCtx();
    expect(renderTile(low, input(tile, { zoom: 15 }), palette).labels).toBe(0);
    const high = new FakeCtx();
    expect(renderTile(high, input(tile, { zoom: 16, dataZoom: 16 }), palette).labels).toBe(1);
    expect(high.calls.find((c) => c.op === 'fillText')!.args).toEqual(['Amselweg', 128, 96]);
    // Overzoom: every drawn quarter gets its own label in the middle of the visible part of the street.
    const deep = new FakeCtx();
    expect(
      renderTile(deep, input(tile, { zoom: 18, dataZoom: 16, sub: { x: 3, y: 1 } }), palette)
        .labels,
    ).toBe(1);
    expect(deep.calls.find((c) => c.op === 'fillText')!.args).toEqual(['Amselweg', 128, 128]);
  });

  it('style table: unknown classes fall back to the layer default, widths follow the zoom', () => {
    expect(styleOf('road', 'bridleway')).toEqual(styleOf('road', undefined));
    expect(styleOf('road', 'motorway')!.kind).toBe('line');
    expect(styleOf('nothing', 'x')).toBeUndefined();
    expect(widthAt(4, 16)).toBe(4);
    expect(widthAt(4, 14)).toBe(1);
    expect(widthAt(4, 19)).toBe(16);
    expect(widthAt(1, 10)).toBe(0.6);
  });
});
