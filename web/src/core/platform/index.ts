import { createWebPlatform } from './web';
import type { PlatformService } from './types';

export type { PlatformKind, PlatformService, SaveFileRequest } from './types';

let current: PlatformService = createWebPlatform();

/** The platform this app runs on. Synchronous; `initPlatform()` must have completed at startup. */
export const getPlatform = (): PlatformService => current;

/** Tests and stories can swap the platform; production code never calls this. */
export function setPlatform(platform: PlatformService | undefined): void {
  current = platform ?? createWebPlatform();
}

/**
 * Picks the implementation: the native shell injects `__TAURI_INTERNALS__` into its webview. This is
 * the only place that looks for it. The Tauri adapter is imported lazily so the plain PWA bundle
 * never contains it.
 */
export async function initPlatform(): Promise<PlatformService> {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    const { createTauriPlatform } = await import('./tauri');
    current = await createTauriPlatform();
  }
  return current;
}
