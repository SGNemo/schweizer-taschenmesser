import { invoke } from '@tauri-apps/api/core';
import type { CustomTabsService } from '../customTabs';

/** Bridge to the `custom-tabs` plugin (Android only). */
export function createCustomTabs(supported: boolean): CustomTabsService {
  if (!supported) return { supported: false, open: () => Promise.reject(new Error('unsupported')) };
  return {
    supported: true,
    open: (url: string) => invoke<void>('plugin:custom-tabs|open', { request: { url } }),
  };
}
