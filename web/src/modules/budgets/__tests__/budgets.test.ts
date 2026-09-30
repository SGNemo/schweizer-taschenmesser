import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { budgetStatus, goalProgress } from '../logic';
import manifest from '../manifest';
import { budgetRepo, deleteGoal, depositRepo, goalRepo } from '../repo';
import { budgetSchema, depositSchema, goalSchema } from '../schema';

beforeEach(async () => {
  for (const t of ['budget', 'goal', 'deposit']) await db.table(`budgets_${t}`).clear();
});

describe('budget status', () => {
  it.each([
    [10000, 0, 'ok', 0],
    [10000, 7900, 'ok', 79],
    [10000, 8000, 'warn', 80],
    [10000, 10000, 'warn', 100], // exactly at the limit is not yet over
    [10000, 10001, 'over', 100],
    [10000, 25000, 'over', 250],
  ])('limit %i spent %i → %s', (limit, spent, tone, pct) => {
    const s = budgetStatus(limit, spent);
    expect(s.tone).toBe(tone);
    expect(s.pct).toBe(pct);
    expect(s.remaining).toBe(limit - spent);
  });
});

describe('goal progress', () => {
  const today = '2026-09-29';

  it('sums deposits and withdrawals', () => {
    const p = goalProgress(
      { targetMinor: 100000 },
      [{ amountMinor: 30000 }, { amountMinor: 20000 }, { amountMinor: -5000 }],
      today,
    );
    expect(p).toMatchObject({ saved: 45000, remaining: 55000, pct: 45, reached: false });
    expect(p.perMonth).toBeUndefined();
  });

  it('knows when the goal is reached and never shows a negative remainder', () => {
    const p = goalProgress(
      { targetMinor: 1000, deadline: '2027-01-01' },
      [{ amountMinor: 1500 }],
      today,
    );
    expect(p).toMatchObject({ reached: true, remaining: 0, pct: 100 });
    expect(p.perMonth).toBeUndefined();
    expect(goalProgress({ targetMinor: 1000 }, [{ amountMinor: -50 }], today).pct).toBe(0);
  });

  it('computes the monthly amount up to the deadline', () => {
    // ~3 months left (2026-09-29 → 2026-12-29 is 91 days → 3 months)
    const p = goalProgress(
      { targetMinor: 90000, deadline: '2026-12-29' },
      [{ amountMinor: 0 }],
      today,
    );
    expect(p.perMonth).toBe(30000);
    // rounds up, at least one month
    expect(goalProgress({ targetMinor: 1000, deadline: '2026-09-30' }, [], today).perMonth).toBe(
      1000,
    );
    expect(
      goalProgress({ targetMinor: 1000, deadline: '2026-09-01' }, [], today).perMonth,
    ).toBeUndefined(); // deadline passed
  });
});

describe('budgets module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('validates data', () => {
    expect(budgetSchema.safeParse({ categoryId: 'c', monthlyLimitMinor: 0 }).success).toBe(false);
    expect(goalSchema.safeParse({ name: 'Urlaub', targetMinor: 1.5 }).success).toBe(false);
    expect(
      depositSchema.safeParse({ goalId: 'g', amountMinor: 0, date: '2026-01-01' }).success,
    ).toBe(false);
    expect(
      depositSchema.safeParse({ goalId: 'g', amountMinor: -100, date: '2026-01-01' }).success,
    ).toBe(true);
  });

  it('deleting a goal removes its deposits only', async () => {
    const a = await goalRepo.create({ name: 'A', targetMinor: 1000 });
    const b = await goalRepo.create({ name: 'B', targetMinor: 1000 });
    await depositRepo.create({ goalId: a.id, amountMinor: 100, date: '2026-09-01' });
    await depositRepo.create({ goalId: b.id, amountMinor: 200, date: '2026-09-01' });
    await budgetRepo.create({ categoryId: 'cat-food', monthlyLimitMinor: 30000 });
    await deleteGoal(a.id);
    expect((await goalRepo.active().toArray()).map((g) => g.name)).toEqual(['B']);
    expect((await depositRepo.active().toArray()).map((d) => d.amountMinor)).toEqual([200]);
    expect(await budgetRepo.active().count()).toBe(1);
  });
});
