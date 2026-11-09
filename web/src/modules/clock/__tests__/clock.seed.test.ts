import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { placeSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('clock seed', () => {
  it.each(SEED_SCALES)('is deterministic, valid and fits the list (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.place!.length).toBeGreaterThanOrEqual(3);
    expect(rows.place!.length).toBeLessThanOrEqual(12);
    for (const row of rows.place!) expect(placeSchema.safeParse(row.data).success).toBe(true);
  });
});
