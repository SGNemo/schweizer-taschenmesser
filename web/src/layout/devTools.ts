import { lazy } from 'react';

/**
 * Dev-Preview-only UI. The literal comparisons are replaced at build time, so stable builds get
 * `undefined` here and bundle none of the dev code (see `core/seed/devFlag.test.ts`).
 */
export const DeveloperSection =
  import.meta.env.VITE_RELEASE_CHANNEL === 'dev'
    ? lazy(() => import('@/pages/settings/DeveloperSection'))
    : undefined;

export const SeedBanner =
  import.meta.env.VITE_RELEASE_CHANNEL === 'dev' ? lazy(() => import('./SeedBanner')) : undefined;

export const loadDevCommands =
  import.meta.env.VITE_RELEASE_CHANNEL === 'dev' ? () => import('./devCommands') : undefined;
