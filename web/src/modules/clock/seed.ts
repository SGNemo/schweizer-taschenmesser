import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data (contract: docs/howto/seed-data.md): invented places in three directions from Europe, so the widget shows
 * "morgen", a plain offset and "gestern" depending on the hour. Pure and deterministic; bump `seed.version` on change.
 */
const PLACES: readonly [label: string, zone: string][] = [
  ['Büro Tokio', 'Asia/Tokyo'],
  ['Tante Ines', 'America/New_York'],
  ['Sydney', 'Australia/Sydney'],
  ['Lissabon', 'Europe/Lisbon'],
  ['Kollegin Pune', 'Asia/Kolkata'],
  ['Vancouver', 'America/Vancouver'],
  ['Kapstadt', 'Africa/Johannesburg'],
  ['São Paulo', 'America/Sao_Paulo'],
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 3, medium: 6, large: PLACES.length });
  return {
    place: PLACES.slice(0, n).map(([label, zone], order) => ({
      id: ctx.id('clock', 'place', order),
      data: { label, zone, order },
    })),
  };
}

export default { seed } satisfies SeedModule;
