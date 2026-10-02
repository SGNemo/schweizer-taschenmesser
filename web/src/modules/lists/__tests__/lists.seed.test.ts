import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { itemSchema, listSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('lists seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schemas (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    for (const row of rows.list!) expect(listSchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.item!) expect(itemSchema.safeParse(row.data).success).toBe(true);
    const listIds = new Set(rows.list!.map((l) => l.id));
    expect(listIds.has('shopping-default')).toBe(true);
    for (const row of rows.item!) expect(listIds.has(row.data.listId as string)).toBe(true);
  });
});
