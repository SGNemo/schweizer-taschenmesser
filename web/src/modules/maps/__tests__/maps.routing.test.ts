import { describe, expect, it, vi } from 'vitest';
import { MapsError } from '../geocode';
import {
  describeStep,
  fetchPlan,
  isDrivingMode,
  parsePlan,
  routeUrl,
  splitDuration,
  thin,
} from '../routing';

const A = { label: 'A', lat: 49.5981234, lon: 11.0044567 };
const B = { label: 'B', lat: 49.5712, lon: 11.0257 };
const TEMPLATE = 'https://routing.openstreetmap.de/routed-{profile}';
const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const OK = {
  code: 'Ok',
  routes: [
    {
      distance: 1234.5,
      duration: 600,
      geometry: {
        coordinates: [
          [11.0044, 49.5981],
          [11.0257, 49.5712],
        ],
      },
      legs: [
        {
          steps: [
            { distance: 10, duration: 5, name: ' Weg ', maneuver: { type: 'depart' } },
            { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive' } },
          ],
        },
      ],
    },
  ],
};

describe('routeUrl', () => {
  it('maps the way of travel to the profile and sends coordinates only, lon,lat, rounded', () => {
    const url = routeUrl(TEMPLATE + '/', 'walk', [A, B]);
    expect(url).toBe(
      'https://routing.openstreetmap.de/routed-foot/route/v1/driving/11.00446,49.59812;11.0257,49.5712?overview=full&geometries=geojson&steps=true&alternatives=false',
    );
    expect(routeUrl(TEMPLATE, 'bike', [A, B])).toContain('/routed-bike/');
    expect(routeUrl(TEMPLATE, 'car', [A, B])).toContain('/routed-car/');
    expect(url).not.toContain('A');
  });

  it('only walking, cycling and driving are routed in the app', () => {
    expect(['walk', 'bike', 'car'].every((m) => isDrivingMode(m as 'walk'))).toBe(true);
    expect(isDrivingMode('transit')).toBe(false);
  });
});

describe('parsePlan', () => {
  it('reads distance, time, line and steps', () => {
    const plan = parsePlan(OK);
    expect(plan.distance).toBe(1234.5);
    expect(plan.duration).toBe(600);
    expect(plan.line).toEqual([
      { lat: 49.5981, lon: 11.0044 },
      { lat: 49.5712, lon: 11.0257 },
    ]);
    expect(plan.steps.map((s) => [s.type, s.name])).toEqual([
      ['depart', 'Weg'],
      ['arrive', undefined],
    ]);
  });

  it('NoRoute and odd shapes become calm errors', () => {
    expect(() => parsePlan({ code: 'NoRoute' })).toThrow(new MapsError('noroute'));
    expect(() => parsePlan({ code: 'Ok', routes: [] })).toThrow(MapsError);
    expect(() => parsePlan('nope')).toThrow(new MapsError('shape'));
  });
});

describe('fetchPlan', () => {
  it('asks once and returns the plan', async () => {
    const f = answer(OK);
    const plan = await fetchPlan('bike', [A, B], { template: TEMPLATE, fetch: f });
    expect(plan.distance).toBe(1234.5);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('needs two to five points and asks nothing otherwise', async () => {
    const f = answer(OK);
    await expect(fetchPlan('car', [A], { fetch: f })).rejects.toThrow(MapsError);
    await expect(fetchPlan('car', [A, A, A, A, A, B], { fetch: f })).rejects.toThrow(MapsError);
    expect(f).not.toHaveBeenCalled();
  });

  it('reads NoRoute from a 400, other failures are errors', async () => {
    await expect(
      fetchPlan('car', [A, B], { fetch: answer({ code: 'NoRoute' }, 400) }),
    ).rejects.toThrow(new MapsError('noroute'));
    await expect(fetchPlan('car', [A, B], { fetch: answer({}, 500) })).rejects.toThrow(
      new MapsError('http 500'),
    );
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(fetchPlan('car', [A, B], { fetch: down })).rejects.toThrow(
      new MapsError('network'),
    );
  });
});

describe('helpers', () => {
  it('thin keeps the ends and the maximum', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => i);
    const out = thin(pts, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe(0);
    expect(out[99]).toBe(4999);
    expect(thin([1, 2, 3], 100)).toEqual([1, 2, 3]);
  });

  it('describes steps without words and splits durations', () => {
    expect(
      describeStep({ distance: 1, duration: 1, type: 'turn', modifier: 'slight left' }),
    ).toEqual({
      kind: 'turn',
      direction: 'slightLeft',
      name: undefined,
    });
    expect(describeStep({ distance: 1, duration: 1, type: 'rotary', name: 'Ring' }).kind).toBe(
      'roundabout',
    );
    expect(describeStep({ distance: 1, duration: 1, type: 'new name' }).kind).toBe('continue');
    expect(splitDuration(10)).toEqual({ h: 0, m: 1 });
    expect(splitDuration(3720)).toEqual({ h: 1, m: 2 });
  });
});
