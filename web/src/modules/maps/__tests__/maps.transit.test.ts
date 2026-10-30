import { describe, expect, it, vi } from 'vitest';
import { MapsError } from '../geocode';
import {
  connectionPath,
  decodePolyline,
  fetchConnections,
  legKind,
  parseConnections,
  transitUrl,
} from '../transit';

const A = { label: 'A', lat: 49.5981234, lon: 11.0044567 };
const B = { label: 'B', lat: 49.4521, lon: 11.0767 };
const BASE = 'https://api.transitous.org/api/v1';
const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const OK = {
  itineraries: [
    {
      duration: 1800,
      startTime: '2026-11-02T08:00:00Z',
      endTime: '2026-11-02T08:30:00Z',
      transfers: 0,
      legs: [
        {
          mode: 'WALK',
          startTime: '2026-11-02T08:00:00Z',
          endTime: '2026-11-02T08:05:00Z',
          from: { name: 'Start', lat: 49.5981, lon: 11.0044 },
          to: { name: 'Hbf', lat: 49.5959, lon: 11.0 },
        },
        {
          mode: 'REGIONAL_RAIL',
          startTime: '2026-11-02T08:10:00Z',
          endTime: '2026-11-02T08:30:00Z',
          from: { name: 'Hbf', lat: 49.5959, lon: 11.0 },
          to: { name: 'Nürnberg Hbf', lat: 49.4521, lon: 11.0767 },
          routeShortName: 'RE 1',
          headsign: 'Nürnberg',
          legGeometry: { points: '_p~iF~ps|U_ulLnnqC', precision: 5 },
        },
      ],
    },
  ],
};

describe('transitUrl', () => {
  it('sends only coordinates (rounded), the time and the count', () => {
    const url = new URL(transitUrl(BASE + '/', A, B, new Date('2026-11-02T08:00:00Z')));
    expect(url.origin + url.pathname).toBe('https://api.transitous.org/api/v1/plan');
    expect([...url.searchParams.keys()].sort()).toEqual([
      'fromPlace',
      'numItineraries',
      'time',
      'toPlace',
    ]);
    expect(url.searchParams.get('fromPlace')).toBe('49.59812,11.00446');
    expect(url.searchParams.get('time')).toBe('2026-11-02T08:00:00.000Z');
  });
});

describe('decodePolyline', () => {
  it('decodes the textbook example', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC', 5)).toEqual([
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
    ]);
  });
  it('stops quietly on a broken string', () => {
    expect(decodePolyline('_p~iF~ps|U_', 5)).toHaveLength(1);
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('parseConnections', () => {
  it('reads times, changes, legs and a path (falls back to a straight line)', () => {
    const [c] = parseConnections(OK);
    expect(c!.duration).toBe(1800);
    expect(c!.transfers).toBe(0);
    expect(c!.legs.map((l) => l.kind)).toEqual(['walk', 'train']);
    expect(c!.legs[1]).toMatchObject({ line: 'RE 1', headsign: 'Nürnberg' });
    expect(c!.legs[0]!.path).toHaveLength(2);
    expect(c!.legs[1]!.path[0]).toEqual({ lat: 38.5, lon: -120.2 });
    expect(connectionPath(c!)).toHaveLength(4);
  });

  it('no connection and odd shapes are calm errors', () => {
    expect(() => parseConnections({ itineraries: [] })).toThrow(new MapsError('noroute'));
    expect(() => parseConnections({})).toThrow(new MapsError('noroute'));
    expect(() => parseConnections({ itineraries: [{ nope: 1 }] })).toThrow(new MapsError('shape'));
  });

  it('classifies modes', () => {
    expect(legKind('WALK')).toBe('walk');
    expect(legKind('BUS')).toBe('bus');
    expect(legKind('tram')).toBe('tram');
    expect(legKind('HIGHSPEED_RAIL')).toBe('train');
    expect(legKind('SUBWAY')).toBe('train');
    expect(legKind('FERRY')).toBe('other');
  });
});

describe('fetchConnections', () => {
  it('asks once', async () => {
    const f = answer(OK);
    const out = await fetchConnections(A, B, { template: BASE, fetch: f, at: new Date(0) });
    expect(out).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('maps failures', async () => {
    await expect(fetchConnections(A, B, { fetch: answer({}, 500) })).rejects.toThrow(
      new MapsError('http 500'),
    );
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(fetchConnections(A, B, { fetch: down })).rejects.toThrow(new MapsError('network'));
  });
});
