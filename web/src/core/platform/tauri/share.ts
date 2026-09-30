import { invoke } from '@tauri-apps/api/core';
import { webShare } from '../web';
import type { ShareService, SharedContent } from '../types';

/** Android: the `share-intent` plugin keeps the latest ACTION_SEND text until we take it. */
export function createShare(supported: boolean): ShareService {
  if (!supported) return webShare;
  return {
    supported,
    async takePending() {
      const shared = await invoke<SharedContent | null>('plugin:share-intent|take_pending');
      return shared ?? undefined;
    },
  };
}
