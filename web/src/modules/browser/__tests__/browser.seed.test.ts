import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { blockruleSchema, bookmarkSchema, historySchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('browser seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schemas (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.bookmark!.length).toBeGreaterThan(0);
    for (const r of rows.bookmark!) expect(bookmarkSchema.safeParse(r.data).success).toBe(true);
    for (const r of rows.history!) expect(historySchema.safeParse(r.data).success).toBe(true);
    for (const r of rows.blockrule!) expect(blockruleSchema.safeParse(r.data).success).toBe(true);
  });
});
