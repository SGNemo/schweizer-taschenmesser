import { invoke } from '@tauri-apps/api/core';
import { webShare } from '../web';
import type { ShareService, SharedContent, ShortcutTarget } from '../types';

const SHORTCUT_TARGETS: readonly ShortcutTarget[] = ['capture', 'search', 'today'];

/** Raw plugin answer: `open` is checked against the fixed list before the app sees it. */
type RawShared = Omit<SharedContent, 'open'> & { open?: string | null };

/**
 * Android: the `share-intent` plugin keeps the latest ACTION_SEND text, or the screen a launcher
 * shortcut / the quick-settings tile asked for, until we take it.
 */
export function createShare(supported: boolean): ShareService {
  if (!supported) return webShare;
  return {
    supported,
    async takePending() {
      const shared = await invoke<RawShared | null>('plugin:share-intent|take_pending');
      if (!shared) return undefined;
      const { open, ...rest } = shared;
      const target = SHORTCUT_TARGETS.find((t) => t === open);
      return target ? { ...rest, open: target } : rest;
    },
  };
}
