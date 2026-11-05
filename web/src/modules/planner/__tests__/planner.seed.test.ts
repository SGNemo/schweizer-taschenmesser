import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { daySchema, itemSchema } from '../schema';
import seedModule from '../seed';

describe('planner seed', () => {
  it.each(SEED_SCALES)('is deterministic and matches the schema (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.day!.length).toBeGreaterThan(0);
    for (const row of rows.day!) expect(daySchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.item!) expect(itemSchema.safeParse(row.data).success).toBe(true);
    // A day off, a blocker, a pinned thing and a hard due are in every scale.
    expect(rows.day!.some((d) => d.data.availableMin === 0)).toBe(true);
    expect(rows.day!.some((d) => (d.data.blockers as unknown[]).length > 0)).toBe(true);
    expect(rows.item!.some((i) => typeof i.data.pinned === 'string')).toBe(true);
    expect(
      rows.item!.some((i) => (i.data.due as { hard?: boolean } | undefined)?.hard === true),
    ).toBe(true);
    expect(rows.item!.every((i) => String(i.id).startsWith('todos:seed-todos-task-'))).toBe(true);
  });

  it('a larger scale covers more days, never fewer', () => {
    const n = (scale: 'small' | 'medium' | 'large') =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale })).day!
        .length;
    expect(n('small')).toBeLessThanOrEqual(n('medium'));
    expect(n('medium')).toBeLessThanOrEqual(n('large'));
  });
});
