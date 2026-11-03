import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { runningSession } from '../logic';
import { clientSchema, jobSchema, sessionSchema } from '../schema';
import seedModule from '../seed';

// The generic contract (all modules, runner, removal) lives in core/seed/registry.test.ts.
describe('timetrack seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schemas (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-11-03', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.job!.length).toBeGreaterThan(0);
    for (const r of rows.client!) expect(clientSchema.safeParse(r.data).success).toBe(true);
    for (const r of rows.job!) expect(jobSchema.safeParse(r.data).success).toBe(true);
    for (const r of rows.session!) expect(sessionSchema.safeParse(r.data).success).toBe(true);
    // Nothing runs by itself: the seed only holds finished sessions.
    expect(
      runningSession(rows.session!.map((r) => r.data as { endTime?: string })),
    ).toBeUndefined();
  });
});
