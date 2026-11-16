import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { itemSchema } from '../schema';
import mod from '../seed';

describe('exchange seed', () => {
  it('is deterministic and valid', () => {
    const ctx = () =>
      createSeedContext({ moduleId: 'exchange', today: '2026-11-16', scale: 'small' });
    const a = mod.seed(ctx());
    const b = mod.seed(ctx());
    expect(a).toEqual(b);
    const rows = a.item ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(itemSchema.safeParse(r.data).success).toBe(true);
  });
});
