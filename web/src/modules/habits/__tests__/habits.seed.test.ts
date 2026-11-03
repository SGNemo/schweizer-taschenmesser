import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { entrySchema, goalSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('habits seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schemas (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-11-03', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.goal!.length).toBeGreaterThan(0);
    for (const row of rows.goal!) expect(goalSchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.entry!) expect(entrySchema.safeParse(row.data).success).toBe(true);
  });

  it('keys an entry by goal and day, so devices converge on one record', () => {
    const rows = seedModule.seed(
      createSeedContext({ moduleId: manifest.id, today: '2026-11-03', scale: 'small' }),
    );
    for (const row of rows.entry!) {
      const d = row.data as { goalId: string; date: string };
      expect(row.id).toBe(`${d.goalId}:${d.date}`);
    }
  });

  it('has rest days and an open today so the rings are alive', () => {
    const rows = seedModule.seed(
      createSeedContext({ moduleId: manifest.id, today: '2026-11-03', scale: 'medium' }),
    );
    const entries = rows.entry!.map((r) => r.data as { skipped?: boolean; date: string });
    expect(entries.some((e) => e.skipped)).toBe(true);
    expect(entries.every((e) => e.date <= '2026-11-03')).toBe(true);
  });
});
