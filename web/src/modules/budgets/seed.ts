import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

// Category ids are the fixed finance defaults. Finance's seed puts the 1st-of-month items (rent,
// subscriptions, a concert) into every month, so "home" and "subs" are near and "leisure" over limit.
const BUDGETS: readonly (readonly [string, number])[] = [
  ['cat-leisure', 8000],
  ['cat-home', 95000],
  ['cat-subs', 2500],
  ['cat-food', 40000],
  ['cat-mobility', 18000],
  ['cat-health', 6000],
  ['cat-other', 5000],
];

/** [name, target cents, deadline in days (undefined = none), monthly deposit cents, note] */
const GOALS: readonly (readonly [
  string,
  number,
  number | undefined,
  number,
  string | undefined,
])[] = [
  ['Urlaub Italien', 200000, 120, 25000, 'Zwei Wochen im Frühjahr'],
  ['Neues Fahrrad', 90000, 60, 15000, undefined],
  ['Notgroschen', 500000, undefined, 20000, 'Drei Monatsgehälter'],
  ['Laptop', 150000, 200, 10000, undefined],
];

function seed(ctx: SeedContext): SeedRows {
  const budgetCount = ctx.count({ small: 4, medium: 6, large: 7 });
  const goalCount = ctx.count({ small: 2, medium: 4, large: 24 });
  const depositMonths = ctx.count({ small: 2, medium: 5, large: 10 });

  const budget: SeedRow[] = BUDGETS.slice(0, budgetCount).map(([categoryId, limit]) => ({
    id: ctx.id('budgets', 'budget', categoryId),
    data: { categoryId, monthlyLimitMinor: limit },
  }));

  const goal: SeedRow[] = [];
  const deposit: SeedRow[] = [];
  for (let i = 0; i < goalCount; i++) {
    const base = GOALS[i % GOALS.length]!;
    const name = i < GOALS.length ? base[0] : `${base[0]} ${Math.floor(i / GOALS.length) + 1}`;
    const target = i < GOALS.length ? base[1] : base[1] + ctx.rng.int(-20, 20) * 1000;
    const goalId = ctx.id('budgets', 'goal', i);
    goal.push({
      id: goalId,
      data: {
        name,
        targetMinor: target,
        ...(base[2] !== undefined
          ? { deadline: ctx.day(base[2] + (i < GOALS.length ? 0 : i * 3)) }
          : {}),
        ...(base[4] ? { note: base[4] } : {}),
      },
    });
    for (let k = 0; k < depositMonths; k++) {
      deposit.push({
        id: ctx.id('budgets', 'deposit', `${i}-${k}`),
        data: {
          goalId,
          amountMinor: base[3] + (k % 2 === 0 ? 0 : ctx.rng.int(0, 5) * 500),
          date: ctx.day(-30 * k - ctx.rng.int(0, 3)),
        },
      });
    }
    if (i % 2 === 1 && depositMonths > 2) {
      deposit.push({
        id: ctx.id('budgets', 'deposit', `${i}-out`),
        data: { goalId, amountMinor: -5000, date: ctx.day(-20), note: 'Entnahme' },
      });
    }
  }
  return { budget, goal, deposit };
}

export default { seed } satisfies SeedModule;
