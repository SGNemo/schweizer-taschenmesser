/**
 * An invented Overpass answer (`out geom` shape) around the seed's coordinates, for unit, page and e2e
 * tests of the builder. Nothing of it is real: streets, names and water are made up.
 */
import { SAMPLE_CENTER } from './sample';
import type { OverpassAnswer } from './overpass';

const M_LAT = 1 / 111_320;
const M_LON = 1 / (111_320 * Math.cos((SAMPLE_CENTER.lat * Math.PI) / 180));
const at = (east: number, north: number) => ({
  lat: Math.round((SAMPLE_CENTER.lat + north * M_LAT) * 1e7) / 1e7,
  lon: Math.round((SAMPLE_CENTER.lon + east * M_LON) * 1e7) / 1e7,
});
const line = (...pts: [number, number][]) => pts.map(([e, n]) => at(e, n));
const ring = (x0: number, y0: number, x1: number, y1: number) => [
  at(x0, y0),
  at(x1, y0),
  at(x1, y1),
  at(x0, y1),
  at(x0, y0),
];

/** Streets, a rail line, water (a closed way and a multipolygon with a hole), a park and a town name. */
export function overpassFixture(): OverpassAnswer {
  return {
    elements: [
      {
        type: 'way',
        id: 1,
        tags: { highway: 'primary', name: 'Hauptstraße' },
        geometry: line([-2500, 0], [2500, 0]),
      },
      {
        type: 'way',
        id: 2,
        tags: { highway: 'secondary', name: 'Bahnhofstraße' },
        geometry: line([0, -2000], [0, 2000]),
      },
      {
        type: 'way',
        id: 3,
        tags: { highway: 'residential', name: 'Amselweg' },
        geometry: line([300, -900], [300, -100], [800, -100]),
      },
      {
        type: 'way',
        id: 4,
        tags: { highway: 'footway' },
        geometry: line([-700, -200], [-100, 120]),
      },
      {
        type: 'way',
        id: 5,
        tags: { railway: 'rail' },
        geometry: line([-2500, -1050], [2500, -700]),
      },
      {
        type: 'way',
        id: 6,
        tags: { natural: 'water', name: 'Teich' },
        geometry: ring(800, -700, 1000, -500),
      },
      { type: 'way', id: 7, tags: { leisure: 'park' }, geometry: ring(-700, -300, -100, 150) },
      {
        type: 'way',
        id: 8,
        tags: { landuse: 'residential' },
        geometry: ring(100, -1000, 900, -100),
      },
      {
        type: 'way',
        id: 9,
        tags: { landuse: 'farmland' },
        geometry: ring(-2400, 500, -1500, 1500),
      },
      {
        type: 'relation',
        id: 10,
        tags: { type: 'multipolygon', natural: 'water', name: 'See' },
        members: [
          {
            type: 'way',
            ref: 11,
            role: 'outer',
            geometry: line([1200, 300], [2000, 300], [2000, 900]),
          },
          {
            type: 'way',
            ref: 12,
            role: 'outer',
            geometry: line([2000, 900], [1200, 900], [1200, 300]),
          },
          { type: 'way', ref: 13, role: 'inner', geometry: ring(1500, 500, 1700, 700) },
        ],
      },
      {
        type: 'node',
        id: 20,
        lat: at(0, -150).lat,
        lon: at(0, -150).lon,
        tags: { place: 'town', name: 'Nemostadt' },
      },
      {
        type: 'node',
        id: 21,
        lat: at(-400, 80).lat,
        lon: at(-400, 80).lon,
        tags: { amenity: 'cafe', name: 'Café Flosse' },
      },
      {
        type: 'node',
        id: 22,
        lat: at(50, 50).lat,
        lon: at(50, 50).lon,
        tags: { amenity: 'bench' },
      },
      { type: 'node', id: 23, lat: at(60, 60).lat, lon: at(60, 60).lon },
    ],
  };
}

/** The answer of a server that ran out of time: no elements, a remark. */
export const overpassBusyFixture = (): OverpassAnswer => ({
  elements: [],
  remark: 'runtime error: Query timed out in "query" at line 3 after 60 seconds.',
});
