import { describe, expect, it } from 'vitest';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { createTestDb } from '@/test-utils';
import { tileBbox } from '../own/cut';
import { decodeTile } from '../own/mvt';
import {
  anchorOf,
  dedupe,
  kindOf,
  namesInTile,
  normalize,
  tokensOf,
  type NameEntry,
  type NameKind,
} from '../own/names';
import { SAMPLE_CENTER, sampleRegion } from '../own/sample';
import { searchOwn } from '../own/search';
import { nameSchema } from '../schema';

describe('names: normalising', () => {
  it('folds case, accents and ß, splits words and keeps them unique', () => {
    expect(normalize('Hauptstraße')).toBe('hauptstrasse');
    expect(normalize('Café Flosse')).toBe('cafe flosse');
    expect(normalize('  Sankt-Jürgen  Platz ')).toBe('sankt jurgen platz');
    expect(tokensOf('Am Alten Markt / Alten')).toEqual(['am', 'alten', 'markt']);
    expect(tokensOf('…')).toEqual([]);
  });

  it('names a kind per layer', () => {
    const layers = ['place', 'road', 'water', 'waterway', 'poi', 'landuse', 'building', 'rail'];
    expect(layers.map(kindOf)).toEqual([
      'place',
      'street',
      'water',
      'water',
      'poi',
      'area',
      'poi',
      'other',
    ]);
  });

  it('anchors a point at itself, a line at the middle of its longest part, a polygon at the mean of its ring', () => {
    expect(anchorOf({ type: 'point', geometry: [[[10, 20]]], tags: {} })).toEqual([10, 20]);
    expect(
      anchorOf({
        type: 'line',
        geometry: [
          [
            [0, 0],
            [10, 0],
          ],
          [
            [0, 5],
            [10, 5],
            [20, 5],
          ],
        ],
        tags: {},
      }),
    ).toEqual([10, 5]);
    expect(
      anchorOf({
        type: 'polygon',
        geometry: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        ],
        tags: {},
      }),
    ).toEqual([2, 2]);
    expect(anchorOf({ type: 'line', geometry: [], tags: {} })).toBeUndefined();
  });

  it('dedupes by kind and normalised name, the first entry staying', () => {
    const a: NameEntry = { name: 'Hauptstraße', kind: 'street', lat: 1, lon: 1 };
    const b: NameEntry = { name: 'HAUPTSTRASSE', kind: 'street', lat: 2, lon: 2 };
    const c: NameEntry = { name: 'Hauptstraße', kind: 'place', lat: 3, lon: 3 };
    expect(dedupe([a, b, c])).toEqual([a, c]);
  });
});

describe('names of the fixture town', () => {
  const { tiles } = sampleRegion();
  const deepest = tiles.filter((t) => t.data.z === 16);
  const perTile = deepest.map((t) => ({
    tile: t.data,
    names: namesInTile(decodeTile(new Uint8Array(t.data.bytes)), t.data.z, t.data.x, t.data.y),
  }));
  const all = dedupe(perTile.flatMap((p) => p.names));

  it('finds streets, waters, places and POIs, each once, with a position in the town', () => {
    const byName = new Map(all.map((e) => [e.name, e]));
    expect(byName.get('Amselweg')?.kind).toBe('street');
    expect(byName.get('Nemostadt')?.kind).toBe('place');
    expect(byName.get('Rathaus')?.kind).toBe('poi');
    expect(byName.get('Flosse')?.kind).toBe('water');
    expect(all.filter((e) => e.name === 'Hauptstraße')).toHaveLength(1);
    for (const e of all) {
      expect(Math.abs(e.lat - SAMPLE_CENTER.lat)).toBeLessThan(0.05);
      expect(Math.abs(e.lon - SAMPLE_CENTER.lon)).toBeLessThan(0.05);
    }
  });

  it('anchors every name inside the tile it was read from', () => {
    for (const { tile, names } of perTile) {
      const b = tileBbox(tile.z, tile.x, tile.y);
      for (const e of names) {
        // Positions are rounded to five decimals (about a metre).
        expect(e.lat).toBeGreaterThanOrEqual(b.minLat - 1e-5);
        expect(e.lat).toBeLessThanOrEqual(b.maxLat + 1e-5);
        expect(e.lon).toBeGreaterThanOrEqual(b.minLon - 1e-5);
        expect(e.lon).toBeLessThanOrEqual(b.maxLon + 1e-5);
      }
    }
  });
});

describe('searching the own map', () => {
  const row = (
    name: string,
    kind: NameKind,
    lat: number,
    lon: number,
    regionId = 'r1',
    cell = '13/1/1',
  ) => ({ regionId, cell, name, tokens: tokensOf(name), kind, lat, lon });

  async function setup() {
    const db = createTestDb();
    const names = createRepo(tableName('maps', 'name'), nameSchema, db, { local: true });
    const rows = [
      row('Hauptstraße', 'street', 49.6, 11.0),
      row('Amselweg', 'street', 49.61, 11.0),
      row('Am Alten Markt', 'place', 49.6, 11.01),
      row('Nordstadt', 'place', 49.62, 11.0),
      row('Nordring', 'street', 49.62, 11.01),
      row('Flosse', 'water', 49.59, 11.0),
      row('Café Flosse', 'poi', 49.6, 11.0),
      // The same street in a second cell, a little further away.
      row('Amselweg', 'street', 49.7, 11.0, 'r1', '13/1/2'),
      // Another region knows a street of the same name: one hit per kind and name.
      row('Hauptstraße', 'street', 48.0, 9.0, 'r2', '13/9/9'),
    ];
    await names.createMany(rows.map((data, i) => ({ id: `${data.cell}#${i}`, data })));
    return names;
  }

  it('every word of the query starts a word of the name; case and accents do not matter', async () => {
    const names = await setup();
    expect((await searchOwn('amsel', names)).map((h) => h.name)).toEqual(['Amselweg']);
    expect((await searchOwn('HAUPTSTR', names)).map((h) => h.name)).toEqual(['Hauptstraße']);
    expect((await searchOwn('markt alt', names)).map((h) => h.name)).toEqual(['Am Alten Markt']);
    expect((await searchOwn('cafe', names)).map((h) => h.name)).toEqual(['Café Flosse']);
    expect(await searchOwn('weg', names)).toEqual([]);
    expect(await searchOwn('markt bahnhof', names)).toEqual([]);
    expect(await searchOwn('  ', names)).toEqual([]);
  });

  it('ranks: the name that starts with the query first, then places before streets, then the nearest', async () => {
    const names = await setup();
    expect((await searchOwn('flosse', names)).map((h) => [h.name, h.kind])).toEqual([
      ['Flosse', 'water'],
      ['Café Flosse', 'poi'],
    ]);
    expect((await searchOwn('nord', names)).map((h) => h.name)).toEqual(['Nordstadt', 'Nordring']);
    const far = await searchOwn('amselweg', names, { lat: 49.7, lon: 11.0 });
    expect(far).toHaveLength(1);
    expect(far[0]!.lat).toBe(49.7);
    const near = await searchOwn('amselweg', names, { lat: 49.61, lon: 11.0 });
    expect(near[0]!.lat).toBe(49.61);
  });

  it('gives one hit per kind and name across regions, and at most the limit', async () => {
    const names = await setup();
    const hits = await searchOwn('hauptstrasse', names, { lat: 48.0, lon: 9.0 });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.regionId).toBe('r2');
    expect(await searchOwn('a', names, undefined, 2)).toHaveLength(2);
  });
});
