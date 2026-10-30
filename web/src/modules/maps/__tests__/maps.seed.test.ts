import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { placeSchema, routeSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('maps seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schemas (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.place!.length).toBeGreaterThan(0);
    expect(rows.route!.length).toBeGreaterThan(0);
    for (const row of rows.place!) expect(placeSchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.route!) expect(routeSchema.safeParse(row.data).success).toBe(true);
  });

  it('every pinned entry fills the widget', () => {
    const rows = seedModule.seed(
      createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale: 'small' }),
    );
    expect(rows.place!.some((p) => (p.data as { pinned: boolean }).pinned)).toBe(true);
  });
});
