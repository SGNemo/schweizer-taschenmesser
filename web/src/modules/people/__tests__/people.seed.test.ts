import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { giftSchema, personSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('people seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schema (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.person!.length).toBeGreaterThan(0);
    expect(rows.gift!.length).toBeGreaterThan(0);
    for (const row of rows.person!) expect(personSchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.gift!) expect(giftSchema.safeParse(row.data).success).toBe(true);
    const ids = new Set(rows.person!.map((r) => r.id));
    for (const row of rows.gift!) expect(ids.has(row.data.personId as string)).toBe(true);
  });
});
