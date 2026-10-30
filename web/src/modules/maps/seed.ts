import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data (contract: docs/HOW-TO.md "Seed bauen"): public landmarks of the Erlangen–Nürnberg area with
 * invented purposes, a few routes between them. Pure and deterministic.
 */
const PLACES = [
  {
    name: 'Wohnung',
    lat: 49.5981,
    lon: 11.0044,
    address: 'Schlossplatz, Erlangen',
    category: 'home',
    pinned: true,
  },
  {
    name: 'Büro',
    lat: 49.5712,
    lon: 11.0257,
    address: 'Südgelände, Erlangen',
    category: 'work',
    pinned: true,
  },
  {
    name: 'Bahnhof Erlangen',
    lat: 49.5958,
    lon: 11.002,
    address: 'Bahnhofplatz, Erlangen',
    category: 'other',
    pinned: false,
  },
  {
    name: 'Wochenmarkt',
    lat: 49.5977,
    lon: 11.0059,
    address: 'Hugenottenplatz, Erlangen',
    category: 'shop',
    pinned: false,
  },
  {
    name: 'Hausarzt',
    lat: 49.6012,
    lon: 10.9987,
    address: 'Nürnberger Straße, Erlangen',
    category: 'health',
    pinned: false,
  },
  {
    name: 'Burgberg',
    lat: 49.5934,
    lon: 11.0212,
    address: 'Bergkirchweih, Erlangen',
    category: 'leisure',
    pinned: false,
  },
  {
    name: 'Nürnberg Hbf',
    lat: 49.4456,
    lon: 11.0825,
    address: 'Bahnhofsplatz, Nürnberg',
    category: 'other',
    pinned: false,
  },
  {
    name: 'Bamberger Dom',
    lat: 49.8909,
    lon: 10.8827,
    address: 'Domplatz, Bamberg',
    category: 'leisure',
    pinned: false,
  },
] as const;

const ROUTES = [
  { name: 'Zur Arbeit', mode: 'bike', from: 0, to: 1, pinned: true },
  { name: 'Zum Bahnhof', mode: 'walk', from: 0, to: 2, pinned: false },
  { name: 'Nach Nürnberg', mode: 'transit', from: 2, to: 6, pinned: true },
  { name: 'Ausflug Bamberg', mode: 'car', from: 0, to: 7, pinned: false },
] as const;

const end = (i: number) => ({ label: PLACES[i]!.name, lat: PLACES[i]!.lat, lon: PLACES[i]!.lon });

function seed(ctx: SeedContext): SeedRows {
  const places = ctx.count({ small: 4, medium: 8, large: 8 });
  const routes = ctx.count({ small: 2, medium: 4, large: 4 });
  return {
    place: PLACES.slice(0, places).map((p, i) => ({
      id: ctx.id('maps', 'place', i),
      data: { ...p },
    })),
    route: ROUTES.filter((r) => r.to < places)
      .slice(0, routes)
      .map((r, i) => ({
        id: ctx.id('maps', 'route', i),
        data: {
          name: r.name,
          mode: r.mode,
          from: end(r.from),
          to: end(r.to),
          via: [],
          pinned: r.pinned,
        },
      })),
  };
}

export default { seed } satisfies SeedModule;
