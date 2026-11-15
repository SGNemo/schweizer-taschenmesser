import { Channel, invoke } from '@tauri-apps/api/core';
import type { CareHistory, CleanupProgress, CleanupResult, OptimizeService } from '../optimize';

type CleanupEvent = ({ event: 'progress' } & CleanupProgress) | ({ event: 'done' } & CleanupResult);

/** The webview's user agent names the system; the native side refuses Windows tools elsewhere anyway. */
const isWindows = (): boolean =>
  typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);

/** Bridge to `src-tauri/src/optimize.rs` and the clean-up commands of `disk.rs`. */
export function createOptimize(): OptimizeService {
  const call = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
    try {
      return await invoke<T>(cmd, args);
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : 'error', { cause: e });
    }
  };
  return {
    windows: isWindows(),
    async cleanupScan(onProgress) {
      const channel = new Channel<CleanupEvent>();
      const result = new Promise<CleanupResult>((resolve) => {
        channel.onmessage = (msg) => {
          if (msg.event === 'progress') onProgress(msg);
          else resolve({ places: msg.places, cancelled: msg.cancelled });
        };
      });
      await call('disk_cleanup_scan', { onEvent: channel });
      return result;
    },
    cancelCleanup: () => call('disk_cleanup_cancel'),
    history: () => call<CareHistory>('disk_care_history'),
    openTool: (tool) => call('disk_care_open_tool', { tool }),
  };
}
