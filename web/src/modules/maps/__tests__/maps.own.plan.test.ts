import { describe, expect, it } from 'vitest';
import { tileBbox, tilesCovering } from '../own/cut';
import {
  CELL_ZOOM,
  MAX_CELLS,
  capBbox,
  cellBbox,
  planRegion,
  regionName,
  viewportBbox,
} from '../own/plan';
import { SAMPLE_CENTER } from '../own/sample';

// Erlangen-sized: about 12 km × 10 km.
const city = { minLat: 49.55, maxLat: 49.64, minLon: 10.93, maxLon: 11.09 };
// Bayern-sized.
const land = { minLat: 47.3, maxLat: 50.6, minLon: 9.0, maxLon: 13.9 };

describe('build plan', () => {
  it('lean = z13 cells stored down to z14, full = z14 cells down to z16', () => {
    const lean = planRegion('lean', city);
    expect(lean.cellZoom).toBe(13);
    expect(lean.zooms).toEqual({ min: 8, max: 14 });
    expect(lean.cells.length).toBeGreaterThanOrEqual(12);
    expect(lean.cells.length).toBeLessThanOrEqual(30);
    const full = planRegion('full', city);
    expect(full.cellZoom).toBe(14);
    expect(full.zooms.max).toBe(16);
    expect(full.cells.length).toBeGreaterThan(lean.cells.length * 2);
    // Deterministic order: a build resumes by index.
    expect(planRegion('lean', city).cells).toEqual(lean.cells);
  });

  it('a cell asks for its tile plus a small margin', () => {
    const cell = tilesCovering(city, CELL_ZOOM.lean)[0]!;
    const inner = tileBbox(cell.z, cell.x, cell.y);
    const outer = cellBbox(cell);
    expect(outer.minLat).toBeLessThan(inner.minLat);
    expect(outer.maxLon).toBeGreaterThan(inner.maxLon);
    expect((outer.maxLat - outer.minLat) / (inner.maxLat - inner.minLat)).toBeCloseTo(
      1 + 2 / 32,
      3,
    );
  });

  it('a large area is cut down to a square around its centre, a small one is kept', () => {
    expect(capBbox(city, SAMPLE_CENTER, 'lean')).toEqual({ bbox: city, capped: false });
    const capped = capBbox(land, { lat: 48.14, lon: 11.58 }, 'lean');
    expect(capped.capped).toBe(true);
    expect(tilesCovering(capped.bbox, CELL_ZOOM.lean).length).toBeLessThanOrEqual(MAX_CELLS);
    expect(capped.bbox.minLat).toBeLessThan(48.14);
    expect(capped.bbox.maxLat).toBeGreaterThan(48.14);
    expect(capped.bbox.minLon).toBeLessThan(11.58);
    expect(capped.bbox.maxLon).toBeGreaterThan(11.58);
  });

  it('names a region by the first part of the search label', () => {
    expect(regionName('Erlangen, Bayern, Deutschland')).toBe('Erlangen');
    expect(regionName('49.5981, 11.0044')).toBe('49.5981');
    expect(regionName('   ')).toBe('   ');
  });

  it('the viewport bbox follows the map element: twice the width, twice the area', () => {
    const view = { lat: SAMPLE_CENTER.lat, lon: SAMPLE_CENTER.lon, zoom: 14 };
    const a = viewportBbox(view, 400, 300);
    const b = viewportBbox(view, 800, 300);
    expect(a.minLat).toBeLessThan(SAMPLE_CENTER.lat);
    expect(a.maxLat).toBeGreaterThan(SAMPLE_CENTER.lat);
    expect((b.maxLon - b.minLon) / (a.maxLon - a.minLon)).toBeCloseTo(2, 5);
    expect(b.maxLat - b.minLat).toBeCloseTo(a.maxLat - a.minLat, 8);
  });
});
