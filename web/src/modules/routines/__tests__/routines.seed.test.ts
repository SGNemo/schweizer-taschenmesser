import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import { isDue } from '../logic';
import manifest from '../manifest';
import { routineSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('routines seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schema (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.routine!.length).toBeGreaterThan(0);
    for (const row of rows.routine!) expect(routineSchema.safeParse(row.data).success).toBe(true);
  });

  it('three routines are due on the reference day, the others come round later', () => {
    const rows = seedModule.seed(
      createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale: 'medium' }),
    ).routine!;
    const due = rows.filter((r) => isDue(routineSchema.parse(r.data), '2026-09-29'));
    expect(due).toHaveLength(3);
  });
});
