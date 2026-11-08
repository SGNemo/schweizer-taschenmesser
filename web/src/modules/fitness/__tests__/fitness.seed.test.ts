import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { mealSchema, sessionSchema, templateSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('fitness seed', () => {
  it.each(SEED_SCALES)(
    'is deterministic, matches the schema and leaves today open (%s)',
    (scale) => {
      const make = () =>
        seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
      const rows = make();
      expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
      expect(rows.session!.length).toBeGreaterThan(0);
      expect(rows.meal!.length).toBeGreaterThan(0);
      for (const row of rows.session!) {
        expect(sessionSchema.safeParse(row.data).success).toBe(true);
        expect(row.data.date).not.toBe('2026-09-29');
      }
      for (const row of rows.meal!) expect(mealSchema.safeParse(row.data).success).toBe(true);
      // One plan for tomorrow, one template.
      expect(rows.session!.filter((r) => r.data.planned).map((r) => r.data.date)).toEqual([
        '2026-09-30',
      ]);
      for (const row of rows.template!)
        expect(templateSchema.safeParse(row.data).success).toBe(true);
    },
  );
});
