import { describe, expect, it } from 'vitest';
import { project } from '../logic';
import { cutTile, featuresBbox, simplify, tileBbox, tilesCovering, type Feature } from '../own/cut';
import { EXTENT, decodeTile, ringArea } from '../own/mvt';
import { SAMPLE_CENTER, SAMPLE_ZOOMS, sampleFeatures, sampleRegion } from '../own/sample';

const centre = project(SAMPLE_CENTER.lat, SAMPLE_CENTER.lon, 16);
const T16 = { x: Math.floor(centre.x / 256), y: Math.floor(centre.y / 256) };

describe('cut', () => {
  it('tilesCovering grows with the zoom and tileBbox is its inverse', () => {
    const bbox = featuresBbox(sampleFeatures());
    const z12 = tilesCovering(bbox, 12);
    const z16 = tilesCovering(bbox, 16);
    expect(z12.length).toBeGreaterThanOrEqual(1);
    expect(z12.length).toBeLessThanOrEqual(4);
    expect(z16.length).toBeGreaterThan(z12.length * 4);
    const b = tileBbox(16, T16.x, T16.y);
    expect(b.minLat).toBeLessThan(SAMPLE_CENTER.lat);
    expect(b.maxLat).toBeGreaterThan(SAMPLE_CENTER.lat);
    expect(b.minLon).toBeLessThan(SAMPLE_CENTER.lon);
    expect(b.maxLon).toBeGreaterThan(SAMPLE_CENTER.lon);
    const inside = {
      minLat: b.minLat + 1e-6,
      maxLat: b.maxLat - 1e-6,
      minLon: b.minLon + 1e-6,
      maxLon: b.maxLon - 1e-6,
    };
    expect(tilesCovering(inside, 16)).toEqual([{ z: 16, x: T16.x, y: T16.y }]);
  });

  it('clips lines and polygons to the tile box with its buffer, drops what lies outside', () => {
    const b = tileBbox(16, T16.x, T16.y);
    const far = { lat: b.maxLat + 1, lon: b.maxLon + 1 };
    const features: Feature[] = [
      {
        layer: 'road',
        type: 'line',
        coords: [
          [
            { lat: b.minLat, lon: b.minLon - 0.01 },
            { lat: b.maxLat, lon: b.maxLon + 0.01 },
          ],
        ],
        tags: { class: 'primary' },
      },
      {
        layer: 'landuse',
        type: 'polygon',
        coords: [
          [
            { lat: b.minLat - 0.01, lon: b.minLon - 0.01 },
            { lat: b.minLat - 0.01, lon: b.maxLon + 0.01 },
            { lat: b.maxLat + 0.01, lon: b.maxLon + 0.01 },
            { lat: b.maxLat + 0.01, lon: b.minLon - 0.01 },
            { lat: b.minLat - 0.01, lon: b.minLon - 0.01 },
          ],
        ],
        tags: { class: 'park' },
      },
      { layer: 'poi', type: 'point', coords: [[far]], tags: { name: 'weit weg' } },
      { layer: 'water', type: 'polygon', coords: [[far, far, far, far]], tags: {} },
    ];
    const tile = cutTile(features, 16, T16.x, T16.y, { buffer: 64 });
    expect(tile).toBeDefined();
    const names = tile!.layers.map((l) => l.name).sort();
    expect(names).toEqual(['landuse', 'road']);
    for (const layer of tile!.layers)
      for (const f of layer.features)
        for (const part of f.geometry)
          for (const [x, y] of part) {
            expect(x).toBeGreaterThanOrEqual(-64);
            expect(x).toBeLessThanOrEqual(EXTENT + 64);
            expect(y).toBeGreaterThanOrEqual(-64);
            expect(y).toBeLessThanOrEqual(EXTENT + 64);
          }
    const park = tile!.layers.find((l) => l.name === 'landuse')!.features[0]!;
    expect(park.geometry[0]).toHaveLength(4);
    expect(ringArea(park.geometry[0]!)).toBeGreaterThan(0);
  });

  it('orients exterior rings clockwise and holes the other way, whatever the input', () => {
    const b = tileBbox(16, T16.x, T16.y);
    const lat = (t: number) => b.minLat + (b.maxLat - b.minLat) * t;
    const lon = (t: number) => b.minLon + (b.maxLon - b.minLon) * t;
    const ring = (a: number, c: number) => [
      { lat: lat(a), lon: lon(a) },
      { lat: lat(a), lon: lon(c) },
      { lat: lat(c), lon: lon(c) },
      { lat: lat(c), lon: lon(a) },
      { lat: lat(a), lon: lon(a) },
    ];
    const tile = cutTile(
      [{ layer: 'water', type: 'polygon', coords: [ring(0.2, 0.8), ring(0.4, 0.6)], tags: {} }],
      16,
      T16.x,
      T16.y,
    );
    const [outer, hole] = tile!.layers[0]!.features[0]!.geometry;
    expect(ringArea(outer!)).toBeGreaterThan(0);
    expect(ringArea(hole!)).toBeLessThan(0);
  });

  it('respects minZoom and returns undefined for an empty tile', () => {
    const b = tileBbox(16, T16.x, T16.y);
    const p = { lat: (b.minLat + b.maxLat) / 2, lon: (b.minLon + b.maxLon) / 2 };
    const f: Feature = { layer: 'poi', type: 'point', coords: [[p]], tags: {}, minZoom: 15 };
    expect(cutTile([f], 14, T16.x >> 2, T16.y >> 2)).toBeUndefined();
    expect(cutTile([f], 16, T16.x, T16.y)).toBeDefined();
  });

  it('simplify drops points on a straight line and keeps corners', () => {
    const pts: [number, number][] = [
      [0, 0],
      [50, 0],
      [100, 1],
      [200, 0],
      [200, 100],
    ];
    expect(simplify(pts, 2)).toEqual([
      [0, 0],
      [200, 0],
      [200, 100],
    ]);
    expect(simplify(pts, 0)).toEqual(pts);
  });

  it('the fixture town cuts into decodable tiles at every zoom, with the main street at the centre', () => {
    const { region, tiles } = sampleRegion();
    for (const z of SAMPLE_ZOOMS)
      expect(
        tiles.some((t) => t.data.z === z),
        `zoom ${z}`,
      ).toBe(true);
    expect(region.cells.done).toBe(tiles.length);
    expect(region.bytes).toBe(tiles.reduce((n, t) => n + t.data.size, 0));
    expect(region.bbox.maxLon - region.bbox.minLon).toBeGreaterThan(0.04);
    expect(region.bbox.maxLon - region.bbox.minLon).toBeLessThan(0.06);
    const centreTile = tiles.find(
      (t) => t.data.z === 16 && t.data.x === T16.x && t.data.y === T16.y,
    );
    expect(centreTile).toBeDefined();
    const decoded = decodeTile(new Uint8Array(centreTile!.data.bytes));
    const roads = decoded.layers.find((l) => l.name === 'road')!;
    expect(
      roads.features.some((f) => f.tags.name === 'Hauptstraße' && f.tags.class === 'primary'),
    ).toBe(true);
    expect(decoded.layers.map((l) => l.name)).toContain('building');
    // Every tile is small: the fixture is for tests, not a download.
    expect(Math.max(...tiles.map((t) => t.data.size))).toBeLessThan(20_000);
  });
});
