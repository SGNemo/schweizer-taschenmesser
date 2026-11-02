import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { LaunchService } from '../launch';

const none = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Bridge to `src-tauri/src/association.rs` (desktop only; the registry part only on Windows). */
export function createLaunch(desktop: boolean): LaunchService {
  if (!desktop)
    return {
      supported: false,
      takePending: () => Promise.resolve(null),
      onOpen: () => Promise.resolve(() => undefined),
      isRegistered: () => Promise.resolve(false),
      setRegistered: none,
    };
  return {
    supported: /Windows/i.test(navigator.userAgent),
    takePending: () => invoke<string | null>('launch_take_pending'),
    onOpen: (callback) => listen('launch-open', () => callback()),
    isRegistered: () => invoke<boolean>('association_status'),
    setRegistered: (enabled: boolean) => invoke<void>('association_set', { enabled }),
  };
}
