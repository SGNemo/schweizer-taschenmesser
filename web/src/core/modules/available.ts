import { getPlatform } from '@/core/platform';
import { availableManifestsFor } from './registry';
import type { ModuleManifest } from './types';

/**
 * Modules that exist on the running platform. A function, not a constant: the platform is only
 * known after `initPlatform()`, and module states are synced, so a desktop-only module must also
 * vanish from router, navigation, dashboard and services on the other platforms.
 */
export const availableManifests = (): readonly ModuleManifest[] =>
  availableManifestsFor(getPlatform().kind);
