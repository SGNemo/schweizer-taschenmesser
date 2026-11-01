import { describe, expect, it } from 'vitest';
import { project } from '../logic';
import { tilesCovering } from '../own/cut';
import { overpassBusyFixture, overpassFixture } from '../own/fixtures';
import { decodeTile, encodeTile, type VectorTile } from '../own/mvt';
import { buildParent } from '../own/pyramid';
import { SAMPLE_CENTER } from '../own/sample';
import { handle, runCell, runParent, tilesUnder } from '../own/work';

const c13 = project(SAMPLE_CENTER.lat, SAMPLE_CENTER.lon, 13);
const cell = { z: 13, x: Math.floor(c13.x / 256), y: Math.floor(c13.y / 256) };

describe('cell work', () => {
  it('lists the tiles under a cell down to the deepest stored zoom', () => {
    const under = tilesUnder(cell, 14);
    expect(under).toHaveLength(1 + 4);
    expect(under[0]).toEqual(cell);
    expect(
      under.slice(1).every((t) => t.z === 14 && t.x >> 1 === cell.x && t.y >> 1 === cell.y),
    ).toBe(true);
    expect(tilesUnder(cell, 15)).toHaveLength(1 + 4 + 16);
  });

  it('turns an answer into the cell tiles (z13 and z14), with the streets and the town in them', () => {
    const res = runCell({
      kind: 'cell',
      id: 1,
      level: 'lean',
      cell,
      maxZoom: 14,
      json: JSON.stringify(overpassFixture()),
    });
    expect(res.error).toBeUndefined();
    expect(res.features).toBeGreaterThan(8);
    expect(res.tiles.length).toBeGreaterThanOrEqual(2);
    const top = res.tiles.find((t) => t.z === 13)!;
    const decoded = decodeTile(new Uint8Array(top.bytes));
    const layers = decoded.layers.map((l) => l.name);
    expect(layers).toEqual(expect.arrayContaining(['road', 'rail', 'water', 'landuse', 'place']));
    // At z13 the footway (minZoom 14) is not in; at z14 it is.
    const roads13 = decoded.layers
      .find((l) => l.name === 'road')!
      .features.map((f) => f.tags.class);
    expect(roads13).not.toContain('path');
    const deep = res.tiles.filter((t) => t.z === 14);
    const classes14 = deep.flatMap((t) =>
      decodeTile(new Uint8Array(t.bytes))
        .layers.filter((l) => l.name === 'road')
        .flatMap((l) => l.features.map((f) => f.tags.class)),
    );
    expect(classes14).toContain('path');
  });

  it('reports a busy server and an unreadable answer instead of producing tiles', () => {
    const base = { kind: 'cell' as const, id: 2, level: 'lean' as const, cell, maxZoom: 14 };
    expect(runCell({ ...base, json: JSON.stringify(overpassBusyFixture()) })).toMatchObject({
      error: 'busy',
      tiles: [],
    });
    expect(runCell({ ...base, json: '<html>down</html>' })).toMatchObject({ error: 'shape' });
    expect(runCell({ ...base, json: '{"foo":1}' })).toMatchObject({ error: 'shape' });
    expect(runCell({ ...base, json: '{"elements":[]}' })).toMatchObject({ tiles: [], features: 0 });
  });
});

describe('parent work (the overview)', () => {
  const child = (z: number, x: number, y: number, tile: VectorTile) => ({ z, x, y, tile });
  const road = (name: string, id: number, from: [number, number], to: [number, number]) => ({
    id,
    type: 'line' as const,
    geometry: [[from, to]],
    tags: { class: 'primary', name },
  });

  it('scales the four children into the parent and joins a feature that crosses them', () => {
    // A street that runs through the two upper children, cut at their shared edge.
    const left: VectorTile = {
      layers: [{ name: 'road', features: [road('A', 7, [0, 2048], [4096, 2048])] }],
    };
    const right: VectorTile = {
      layers: [{ name: 'road', features: [road('A', 7, [0, 2048], [4096, 2048])] }],
    };
    const parent = buildParent(12, 10, 20, [child(13, 20, 40, left), child(13, 21, 40, right)]);
    expect(parent).toBeDefined();
    const f = parent!.layers[0]!.features;
    expect(f).toHaveLength(1);
    expect(f[0]!.geometry).toEqual([
      [
        [0, 1024],
        [2048, 1024],
      ],
      [
        [2048, 1024],
        [4096, 1024],
      ],
    ]);
  });

  it('drops what the style table does not draw at the parent zoom and tiny leftovers', () => {
    const tile: VectorTile = {
      layers: [
        {
          name: 'road',
          features: [
            {
              type: 'line',
              geometry: [
                [
                  [0, 0],
                  [4096, 4096],
                ],
              ],
              tags: { class: 'service' },
            }, // minZoom 14
            {
              type: 'line',
              geometry: [
                [
                  [0, 0],
                  [1, 1],
                ],
              ],
              tags: { class: 'primary' },
            }, // too short
          ],
        },
        {
          name: 'building',
          features: [
            {
              type: 'polygon',
              geometry: [
                [
                  [0, 0],
                  [3, 0],
                  [3, 3],
                  [0, 3],
                ],
              ],
              tags: {},
            },
          ],
        },
      ],
    };
    expect(buildParent(12, 0, 0, [child(13, 0, 0, tile)])).toBeUndefined();
    expect(buildParent(13, 0, 0, [child(14, 0, 0, tile)])).toBeUndefined();
  });

  it('runParent encodes the parent, leaving an unreadable child out', () => {
    const tile: VectorTile = {
      layers: [
        {
          name: 'place',
          features: [
            { type: 'point', geometry: [[[100, 100]]], tags: { class: 'town', name: 'X' } },
          ],
        },
      ],
    };
    const bytes = encodeTile(tile);
    const good = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(good).set(bytes);
    const res = runParent({
      kind: 'parent',
      id: 3,
      parent: { z: 12, x: 0, y: 0 },
      children: [
        { z: 13, x: 1, y: 1, bytes: good },
        { z: 13, x: 0, y: 0, bytes: new Uint8Array([0x1a, 0x05, 0x01]).buffer as ArrayBuffer },
      ],
    });
    expect(res.tile).toBeDefined();
    const decoded = decodeTile(new Uint8Array(res.tile!.bytes));
    expect(decoded.layers[0]!.features[0]!.geometry).toEqual([[[2098, 2098]]]);
    expect(handle({ kind: 'parent', id: 4, parent: { z: 12, x: 0, y: 0 }, children: [] })).toEqual({
      kind: 'parent',
      id: 4,
    });
  });

  it('the fixture region overview: every z12 parent of the cells has content', () => {
    const res = runCell({
      kind: 'cell',
      id: 5,
      level: 'lean',
      cell,
      maxZoom: 14,
      json: JSON.stringify(overpassFixture()),
    });
    const parents = tilesCovering(
      {
        minLat: SAMPLE_CENTER.lat - 0.001,
        maxLat: SAMPLE_CENTER.lat + 0.001,
        minLon: SAMPLE_CENTER.lon - 0.001,
        maxLon: SAMPLE_CENTER.lon + 0.001,
      },
      12,
    );
    expect(parents).toHaveLength(1);
    const p = runParent({
      kind: 'parent',
      id: 6,
      parent: parents[0]!,
      children: res.tiles.filter((t) => t.z === 13),
    });
    expect(p.tile).toBeDefined();
    expect(p.tile!.bytes.byteLength).toBeLessThanOrEqual(
      res.tiles.find((t) => t.z === 13)!.bytes.byteLength,
    );
  });
});
