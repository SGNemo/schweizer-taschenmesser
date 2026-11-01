import { describe, expect, it } from 'vitest';
import {
  EXTENT,
  decodeTile,
  encodeTile,
  ringArea,
  unzigzag,
  zigzag,
  type VectorTile,
} from '../own/mvt';

const sample: VectorTile = {
  layers: [
    {
      name: 'poi',
      extent: EXTENT,
      features: [
        {
          id: 7,
          type: 'point',
          geometry: [
            [
              [25, 17],
              [100, 200],
            ],
          ],
          tags: { name: 'Café Flosse', class: 'food', floors: 2, open: true, rating: 4.5 },
        },
      ],
    },
    {
      name: 'road',
      extent: EXTENT,
      features: [
        {
          type: 'line',
          geometry: [
            [
              [0, 0],
              [4096, 0],
            ],
            [
              [10, 10],
              [20, 30],
              [-5, 40],
            ],
          ],
          tags: { class: 'primary', name: 'Hauptstraße', lanes: -1 },
        },
      ],
    },
    {
      name: 'water',
      extent: EXTENT,
      features: [
        {
          type: 'polygon',
          geometry: [
            [
              [0, 0],
              [100, 0],
              [100, 100],
              [0, 100],
            ],
            [
              [20, 20],
              [20, 40],
              [40, 40],
              [40, 20],
            ],
          ],
          tags: {},
        },
      ],
    },
  ],
};

describe('mvt', () => {
  it('zigzag maps signed to unsigned and back', () => {
    for (const n of [0, -1, 1, -2, 2, 4096, -4096, 2 ** 31, -(2 ** 31)]) {
      expect(unzigzag(zigzag(n))).toBe(n);
    }
    expect(zigzag(-1)).toBe(1);
    expect(zigzag(1)).toBe(2);
  });

  it('encodes and decodes a tile with points, lines, polygons and every tag type', () => {
    const bytes = encodeTile(sample);
    expect(bytes.length).toBeGreaterThan(40);
    expect(decodeTile(bytes)).toEqual(sample);
  });

  it('writes the geometry commands of the specification (MoveTo 25,17 = 9 50 34)', () => {
    const bytes = encodeTile({
      layers: [{ name: 'a', features: [{ type: 'point', geometry: [[[25, 17]]], tags: {} }] }],
    });
    const seq = [9, 50, 34];
    const found = [...bytes].some((_, i) => seq.every((b, j) => bytes[i + j] === b));
    expect(found).toBe(true);
  });

  it('drops the repeated closing point of a ring and keeps large ids', () => {
    const tile: VectorTile = {
      layers: [
        {
          name: 'b',
          features: [
            {
              id: 2 ** 40 + 3,
              type: 'polygon',
              geometry: [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 0],
                ],
              ],
              tags: { big: 2 ** 40 },
            },
          ],
        },
      ],
    };
    const out = decodeTile(encodeTile(tile));
    expect(out.layers[0]!.features[0]!.id).toBe(2 ** 40 + 3);
    expect(out.layers[0]!.features[0]!.tags.big).toBe(2 ** 40);
    expect(out.layers[0]!.features[0]!.geometry).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
    ]);
    expect(out.layers[0]!.extent).toBe(EXTENT);
  });

  it('shares keys and values inside a layer', () => {
    const many: VectorTile = {
      layers: [
        {
          name: 'c',
          features: Array.from({ length: 50 }, (_, i) => ({
            type: 'point' as const,
            geometry: [[[i, i]]],
            tags: { class: 'house', name: 'Haus' },
          })),
        },
      ],
    };
    const bytes = encodeTile(many);
    // 50 features × (tags 4 bytes + geometry ~5 bytes + framing) stays far below one copy of the strings each.
    expect(bytes.length).toBeLessThan(50 * 16);
    expect(decodeTile(bytes).layers[0]!.features).toHaveLength(50);
  });

  it('rejects malformed bytes', () => {
    expect(() => decodeTile(new Uint8Array([0x1a, 0x05, 0x01]))).toThrow();
  });

  it('ringArea: clockwise on screen is positive (exterior), the other way negative (hole)', () => {
    expect(
      ringArea([
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ]),
    ).toBeGreaterThan(0);
    expect(
      ringArea([
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
      ]),
    ).toBeLessThan(0);
  });
});
