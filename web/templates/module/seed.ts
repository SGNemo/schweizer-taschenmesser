import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data for the Dev-Preview, E2E tests and screenshots (contract: docs/HOW-TO.md "Seed bauen").
 * Pure and deterministic: only `ctx` (rng, today, day(), id(), count()) – no Date.now(), no
 * Math.random(). Dates relative to `ctx.today`, invented German content, every widget non-empty.
 * Bump `seed.version` in the manifest whenever the output changes.
 */
const TITLES = ['Erster Beispieleintrag', 'Zweiter Beispieleintrag', 'Dritter Beispieleintrag'];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 3, medium: 12, large: 200 });
  return {
    entry: Array.from({ length: n }, (_, i) => ({
      id: ctx.id('__ID__', 'entry', i),
      data: {
        title: i < TITLES.length ? TITLES[i]! : `${ctx.rng.pick(TITLES)} ${i + 1}`,
        done: ctx.rng.chance(0.3),
      },
    })),
  };
}

export default { seed } satisfies SeedModule;
