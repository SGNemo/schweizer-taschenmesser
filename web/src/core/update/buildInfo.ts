/**
 * Which flavor of the app this is. Only the Dev-Preview workflow sets `VITE_RELEASE_CHANNEL=dev`
 * (and `VITE_BUILD_SHA`) when it builds; every stable, beta and PWA build is `stable`.
 */
import type { UpdateChannel } from './types';

export type BuildChannel = 'stable' | 'dev';

export const BUILD_CHANNEL: BuildChannel =
  import.meta.env.VITE_RELEASE_CHANNEL === 'dev' ? 'dev' : 'stable';

/** Short commit id of a Dev-Preview build, '' otherwise. */
export const BUILD_SHA: string =
  BUILD_CHANNEL === 'dev' ? String(import.meta.env.VITE_BUILD_SHA ?? '').slice(0, 7) : '';

export const isDevBuild = (build: BuildChannel = BUILD_CHANNEL): boolean => build === 'dev';

/**
 * The channel the updater really follows. A Dev-Preview build always follows the dev channel; a
 * stable build follows the stored preference, which can never be `dev` – so the stable app cannot be
 * pointed at a preview.
 */
export function effectiveChannel(
  preferred: Exclude<UpdateChannel, 'dev'>,
  build: BuildChannel = BUILD_CHANNEL,
): UpdateChannel {
  return build === 'dev' ? 'dev' : preferred;
}
