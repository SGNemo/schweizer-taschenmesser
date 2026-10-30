import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  distanceMeters,
  fitView,
  formatDistance,
  fromScreen,
  isHttpsUrl,
  isTileTemplate,
  panBy,
  parseCoordinates,
  placeLink,
  project,
  roundCoord,
  routeLink,
  tileUrl,
  toScreen,
  unproject,
  visibleTiles,
  wrapLon,
  zoomAt,
} from '../logic';

const ERLANGEN = { lat: 49.5981, lon: 11.0044 };
const BAHNHOF = { label: 'Bahnhof', lat: 49.5958, lon: 11.002 };
const ARBEIT = { label: 'Arbeit', lat: 49.5712, lon: 11.0257 };

describe('Web Mercator', () => {
  it('projects and unprojects the same position', () => {
    for (const z of [3, 10, 17]) {
      const p = project(ERLANGEN.lat, ERLANGEN.lon, z);
      const q = unproject(p.x, p.y, z);
      expect(q.lat).toBeCloseTo(ERLANGEN.lat, 6);
      expect(q.lon).toBeCloseTo(ERLANGEN.lon, 6);
    }
  });

  it('knows the tile of a known place (Erlangen at zoom 12 is tile 2173/1396)', () => {
    const p = project(ERLANGEN.lat, ERLANGEN.lon, 12);
    expect([Math.floor(p.x / 256), Math.floor(p.y / 256)]).toEqual([2173, 1396]);
  });

  it('wraps longitudes and clamps zoom', () => {
    expect(wrapLon(190)).toBeCloseTo(-170);
    expect(wrapLon(-190)).toBeCloseTo(170);
    expect(clampZoom(0)).toBe(2);
    expect(clampZoom(30)).toBe(19);
  });
});

describe('view changes', () => {
  const view = { ...ERLANGEN, zoom: 14 };

  it('dragging right moves the centre west, and dragging back returns', () => {
    const moved = panBy(view, 100, 0);
    expect(moved.lon).toBeLessThan(view.lon);
    const back = panBy(moved, -100, 0);
    expect(back.lon).toBeCloseTo(view.lon, 6);
    expect(back.lat).toBeCloseTo(view.lat, 6);
  });

  it('zooming at a point keeps that point under the cursor', () => {
    const w = 800;
    const h = 600;
    const px = 600;
    const py = 200;
    const before = fromScreen(view, px, py, w, h);
    const zoomed = zoomAt(view, 16, px, py, w, h);
    const after = fromScreen(zoomed, px, py, w, h);
    expect(after.lat).toBeCloseTo(before.lat, 5);
    expect(after.lon).toBeCloseTo(before.lon, 5);
    expect(zoomed.zoom).toBe(16);
  });

  it('screen position and back agree; the centre is the middle of the element', () => {
    const mid = toScreen(view, view.lat, view.lon, 800, 600);
    expect(mid.x).toBeCloseTo(400);
    expect(mid.y).toBeCloseTo(300);
    const s = toScreen(view, BAHNHOF.lat, BAHNHOF.lon, 800, 600);
    const p = fromScreen(view, s.x, s.y, 800, 600);
    expect(p.lat).toBeCloseTo(BAHNHOF.lat, 6);
  });
});

describe('visibleTiles', () => {
  it('covers the element completely with tiles of the nearest level', () => {
    const w = 800;
    const h = 600;
    const tiles = visibleTiles({ ...ERLANGEN, zoom: 14 }, w, h);
    expect(tiles.every((t) => t.z === 14)).toBe(true);
    expect(Math.min(...tiles.map((t) => t.left))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.left + t.size))).toBeGreaterThanOrEqual(w);
    expect(Math.min(...tiles.map((t) => t.top))).toBeLessThanOrEqual(0);
    expect(Math.max(...tiles.map((t) => t.top + t.size))).toBeGreaterThanOrEqual(h);
    expect(tiles.length).toBeLessThanOrEqual(20);
  });

  it('scales the tiles for a fractional zoom', () => {
    const tiles = visibleTiles({ ...ERLANGEN, zoom: 14.5 }, 400, 300);
    const t = tiles[0]!;
    expect(t.z === 14 || t.z === 15).toBe(true);
    expect(t.size).toBeCloseTo(256 * 2 ** (14.5 - t.z));
  });

  it('wraps tile columns around the date line and never asks beyond the poles', () => {
    const tiles = visibleTiles({ lat: 0, lon: 179.9, zoom: 4 }, 800, 600);
    expect(tiles.every((t) => t.x >= 0 && t.x < 16)).toBe(true);
    const north = visibleTiles({ lat: 85, lon: 0, zoom: 3 }, 800, 800);
    expect(north.every((t) => t.y >= 0)).toBe(true);
  });
});

describe('fitView', () => {
  it('one point: a street-level view; several: all of them fit with padding', () => {
    expect(fitView([ERLANGEN], 800, 600)).toEqual({ ...ERLANGEN, zoom: 15 });
    const v = fitView([BAHNHOF, ARBEIT], 800, 600)!;
    for (const p of [BAHNHOF, ARBEIT]) {
      const s = toScreen(v, p.lat, p.lon, 800, 600);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(800);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(600);
    }
    expect(fitView([], 800, 600)).toBeUndefined();
  });
});

describe('distances and coordinates', () => {
  it('great-circle distance: Erlangen – Nürnberg is about 16 km', () => {
    const d = distanceMeters(ERLANGEN, { lat: 49.4456, lon: 11.0825 });
    expect(d).toBeGreaterThan(15_000);
    expect(d).toBeLessThan(19_000);
    expect(distanceMeters(ERLANGEN, ERLANGEN)).toBe(0);
  });

  it('formats short and long distances', () => {
    expect(formatDistance(850)).toEqual({ value: '850', unit: 'm' });
    expect(formatDistance(843)).toEqual({ value: '840', unit: 'm' });
    expect(formatDistance(3420)).toEqual({ value: '3.4', unit: 'km' });
    expect(formatDistance(12_400)).toEqual({ value: '12', unit: 'km' });
  });

  it('reads coordinates in several spellings and refuses the rest', () => {
    expect(parseCoordinates('49.5981, 11.0044')).toEqual({ lat: 49.5981, lon: 11.0044 });
    expect(parseCoordinates('49,5981; 11,0044')).toEqual({ lat: 49.5981, lon: 11.0044 });
    expect(parseCoordinates('-33.86 151.21')).toEqual({ lat: -33.86, lon: 151.21 });
    expect(parseCoordinates('91, 10')).toBeUndefined();
    expect(parseCoordinates('10, 181')).toBeUndefined();
    expect(parseCoordinates('Erlangen')).toBeUndefined();
    expect(roundCoord(49.598123456)).toBe(49.59812);
  });
});

describe('links to other apps', () => {
  it('a place', () => {
    const p = { ...ERLANGEN, label: 'Schlossplatz' };
    expect(placeLink('osm', p)).toContain('mlat=49.5981&mlon=11.0044');
    expect(placeLink('google', p)).toBe(
      'https://www.google.com/maps/search/?api=1&query=49.5981,11.0044',
    );
    expect(placeLink('apple', p)).toContain('ll=49.5981,11.0044');
    expect(placeLink('geo', p)).toBe('geo:49.5981,11.0044?q=49.5981,11.0044(Schlossplatz)');
  });

  it('a route: OSM engines per mode, Google modes and stops, Apple flags', () => {
    expect(routeLink('osm', 'bike', BAHNHOF, ARBEIT)).toBe(
      'https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=49.5958,11.002;49.5712,11.0257',
    );
    expect(routeLink('osm', 'transit', BAHNHOF, ARBEIT)).toBeNull();
    const g = routeLink('google', 'transit', BAHNHOF, ARBEIT, [{ label: 'Stop', ...ERLANGEN }])!;
    expect(g).toContain('travelmode=transit');
    expect(g).toContain('origin=49.5958%2C11.002');
    expect(g).toContain('waypoints=49.5981%2C11.0044');
    expect(routeLink('apple', 'car', BAHNHOF, ARBEIT)).toContain('dirflg=d');
    expect(routeLink('apple', 'transit', BAHNHOF, ARBEIT)).toContain('dirflg=r');
    expect(routeLink('geo', 'car', BAHNHOF, ARBEIT)).toBeNull();
  });
});

describe('tile and service addresses', () => {
  it('accepts https tile templates with z, x and y only', () => {
    expect(isTileTemplate('https://tile.openstreetmap.org/{z}/{x}/{y}.png')).toBe(true);
    expect(isTileTemplate('https://tiles.example.org/a/{z}/{y}/{x}.png?key=1')).toBe(true);
    expect(isTileTemplate('http://tile.openstreetmap.org/{z}/{x}/{y}.png')).toBe(false);
    expect(isTileTemplate('https://tile.openstreetmap.org/{z}/{x}.png')).toBe(false);
    expect(isTileTemplate('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl('https://nominatim.openstreetmap.org/search')).toBe(true);
    expect(isHttpsUrl('http://x.test')).toBe(false);
    expect(tileUrl('https://t.test/{z}/{x}/{y}.png', 12, 2181, 1417)).toBe(
      'https://t.test/12/2181/1417.png',
    );
  });
});
