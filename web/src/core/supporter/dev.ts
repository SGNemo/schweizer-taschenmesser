import type { SupporterTier } from '@nemo/supporter-codes';

/**
 * Dev-Preview only. The literal comparison is replaced at build time, so a stable build gets
 * `undefined` and bundles none of `devSupporter.ts` (see `core/seed/devFlag.test.ts`).
 */
export const loadDevSupporter =
  import.meta.env.VITE_RELEASE_CHANNEL === 'dev' ? () => import('./devSupporter') : undefined;

/** `undefined` = no override (use the real code), `'none'` = pretend not to be a supporter. */
export type SupporterOverride = SupporterTier | 'none' | undefined;
