import { describe, expect, it } from 'vitest';
import { overpassBusyFixture, overpassFixture } from '../own/fixtures';
import {
  assembleRings,
  isOverloadRemark,
  overpassQuery,
  parseOverpass,
  readAnswer,
} from '../own/overpass';

const bbox = { minLat: 49.59, minLon: 10.99, maxLat: 49.61, maxLon: 11.02 };

describe('overpass query', () => {
  it('asks for one bbox, as JSON with geometry, with a server-side time and size limit', () => {
    const q = overpassQuery(bbox, 'lean');
    expect(q).toContain('[out:json]');
    expect(q).toContain('[timeout:60]');
    expect(q).toContain('[maxsize:');
    expect(q).toContain('out geom;');
    expect(q).toContain('(49.59000,10.99000,49.61000,11.02000)');
    expect(q).not.toMatch(/name|addr/);
  });

  it('the lean query leaves out paths, buildings and POIs; the full one has them', () => {
    const lean = overpassQuery(bbox, 'lean');
    expect(lean).toContain('"highway"');
    expect(lean).toContain('"place"');
    expect(lean).not.toContain('building');
    expect(lean).not.toContain('footway');
    expect(lean).not.toContain('amenity');
    const full = overpassQuery(bbox, 'full');
    expect(full).toContain('way["building"]');
    expect(full).toContain('footway');
    expect(full).toContain('"amenity"');
  });
});

describe('overpass answer', () => {
  it('reads only what is an answer and knows an overloaded server', () => {
    expect(() => readAnswer(null)).toThrow();
    expect(() => readAnswer({ foo: 1 })).toThrow();
    expect(readAnswer({ elements: [{ id: 1, type: 'node' }, 'junk'] }).elements).toHaveLength(1);
    expect(isOverloadRemark(overpassBusyFixture().remark)).toBe(true);
    expect(isOverloadRemark(undefined)).toBe(false);
    expect(isOverloadRemark('runtime warning: something else')).toBe(false);
  });

  it('turns ways, nodes and multipolygons into drawable features and leaves the rest out', () => {
    const features = parseOverpass(overpassFixture());
    const by = (layer: string) => features.filter((f) => f.layer === layer);
    expect(by('road').map((f) => f.tags.class)).toEqual([
      'primary',
      'secondary',
      'residential',
      'path',
    ]);
    expect(by('road')[0]!.tags.name).toBe('Hauptstraße');
    expect(by('road')[0]!.minZoom).toBe(9);
    expect(by('road')[3]!.minZoom).toBe(14);
    expect(by('rail')).toHaveLength(1);
    expect(
      by('landuse')
        .map((f) => f.tags.class)
        .sort(),
    ).toEqual(['park', 'residential']); // farmland is not drawn
    const water = by('water');
    expect(water).toHaveLength(2);
    expect(water[0]!.tags).toEqual({ class: 'lake', name: 'Teich' });
    expect(water[0]!.type).toBe('polygon');
    // The multipolygon: two outer member ways joined into one ring, the inner way as a hole.
    const lake = water[1]!;
    expect(lake.tags.name).toBe('See');
    expect(lake.coords).toHaveLength(2);
    expect(lake.coords[0]).toHaveLength(5);
    expect(lake.coords[1]).toHaveLength(5);
    expect(by('place')).toEqual([
      expect.objectContaining({
        type: 'point',
        tags: { class: 'town', name: 'Nemostadt' },
        minZoom: 8,
      }),
    ]);
    expect(by('poi')).toEqual([
      expect.objectContaining({ tags: { class: 'food', name: 'Café Flosse' }, minZoom: 15 }),
    ]);
    // A bench without a name and a node without tags are not features.
    expect(features.filter((f) => f.id === 22 * 4 || f.id === 23 * 4)).toEqual([]);
    // Ids never collide between nodes, ways and relations.
    expect(new Set(features.map((f) => f.id)).size).toBe(features.length);
  });

  it('assembles rings from member ways in any order and direction, dropping open leftovers', () => {
    const p = (lat: number, lon: number) => ({ lat, lon });
    const rings = assembleRings([
      [p(0, 0), p(0, 1)],
      [p(1, 1), p(1, 0), p(0, 0)], // reversed direction
      [p(0, 1), p(1, 1)],
      [p(5, 5), p(6, 6)], // open leftover
    ]);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(5);
    expect(rings[0]![0]).toEqual(rings[0]![4]);
  });
});
