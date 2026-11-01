import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import manifest from '../manifest';
import { placeSchema, routeSchema } from '../schema';
import {
  DEFAULT_ROUTING_URL,
  DEFAULT_SEARCH_URL,
  DEFAULT_TILE_URL,
  DEFAULT_TRANSIT_URL,
} from '../logic';
import { DEFAULT_OVERPASS_URL } from '../own/overpass';
import { servicesOf } from '../settings';

describe('maps module', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('tells the assistant field names only: no coordinates, no actions', () => {
    const fields = Object.values(manifest.aiSchema!.collections).flatMap((c) =>
      Object.keys(c.fields),
    );
    expect(fields).not.toContain('lat');
    expect(fields).not.toContain('lon');
    expect(fields).not.toContain('from');
    expect(manifest.aiSchema!.actions).toBeUndefined();
  });

  it('validates places and routes', () => {
    expect(placeSchema.safeParse({ name: '', lat: 1, lon: 1 }).success).toBe(false);
    expect(placeSchema.safeParse({ name: 'x', lat: 91, lon: 1 }).success).toBe(false);
    expect(placeSchema.safeParse({ name: 'x', lat: 1, lon: 181 }).success).toBe(false);
    expect(placeSchema.parse({ name: 'x', lat: 1, lon: 1 })).toMatchObject({
      category: 'other',
      pinned: false,
    });
    const end = { label: 'A', lat: 1, lon: 1 };
    expect(routeSchema.parse({ name: 'r', from: end, to: end })).toMatchObject({
      mode: 'walk',
      via: [],
    });
    expect(
      routeSchema.safeParse({ name: 'r', from: end, to: end, via: [end, end, end, end] }).success,
    ).toBe(false);
  });

  it('falls back to the default services for anything that is not a safe https address', () => {
    expect(servicesOf(undefined)).toEqual({
      tileUrl: DEFAULT_TILE_URL,
      searchUrl: DEFAULT_SEARCH_URL,
      routingUrl: DEFAULT_ROUTING_URL,
      transitUrl: DEFAULT_TRANSIT_URL,
      overpassUrl: DEFAULT_OVERPASS_URL,
    });
    expect(
      servicesOf({
        tileUrl: 'http://x.test/{z}/{x}/{y}.png',
        searchUrl: 'ftp://x',
        routingUrl: 'http://r.test',
        transitUrl: 'http://t.test',
        overpassUrl: 'http://o.test',
      }),
    ).toEqual({
      tileUrl: DEFAULT_TILE_URL,
      searchUrl: DEFAULT_SEARCH_URL,
      routingUrl: DEFAULT_ROUTING_URL,
      transitUrl: DEFAULT_TRANSIT_URL,
      overpassUrl: DEFAULT_OVERPASS_URL,
    });
    expect(
      servicesOf({
        tileUrl: 'https://t.example/{z}/{x}/{y}.png',
        searchUrl: 'https://s.example/q',
        routingUrl: 'https://r.example/{profile}',
        transitUrl: 'https://m.example/api',
        overpassUrl: 'https://o.example/api/interpreter',
      }),
    ).toEqual({
      tileUrl: 'https://t.example/{z}/{x}/{y}.png',
      searchUrl: 'https://s.example/q',
      routingUrl: 'https://r.example/{profile}',
      transitUrl: 'https://m.example/api',
      overpassUrl: 'https://o.example/api/interpreter',
    });
  });
});
