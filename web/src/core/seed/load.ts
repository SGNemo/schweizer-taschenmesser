/**
 * The only door to the seed runner. The literal comparison is replaced at build time, so stable
 * builds contain neither this import nor the runner, the per-module `seed.ts` files or the dev UI
 * (checked by `core/seed/devFlag.test.ts`). Always go through `loadSeed`, never import `./dev`.
 */
import type * as SeedRunner from './dev';

export const loadSeed: (() => Promise<typeof SeedRunner>) | undefined =
  import.meta.env.VITE_RELEASE_CHANNEL === 'dev' ? () => import('./dev') : undefined;
