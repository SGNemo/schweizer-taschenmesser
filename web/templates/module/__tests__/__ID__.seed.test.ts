import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { entrySchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('__ID__ seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schema (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.entry!.length).toBeGreaterThan(0);
    for (const row of rows.entry!) expect(entrySchema.safeParse(row.data).success).toBe(true);
  });
});
