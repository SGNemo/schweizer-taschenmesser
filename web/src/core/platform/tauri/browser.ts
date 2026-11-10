import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  BrowserConfig,
  BrowserBounds,
  BrowserEvent,
  BrowserOpenOptions,
  BrowserService,
} from '../browser';

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/**
 * A number for this load of the page, different from the one before (never 0, the native side's start value):
 * random, so it needs no clock and no storage. Exported for the test.
 */
export function pageEpoch(): number {
  const part = new Uint32Array(1);
  crypto.getRandomValues(part);
  return part[0]! + 1;
}

/** Bridge to `src-tauri/src/browser.rs`. Only the main window may call these commands. */
export function createBrowser(supported: boolean): BrowserService {
  if (!supported)
    return {
      supported: false,
      open: unsupported,
      navigate: unsupported,
      back: unsupported,
      forward: unsupported,
      reload: unsupported,
      close: unsupported,
      show: unsupported,
      setZoom: unsupported,
      configure: unsupported,
      clearData: unsupported,
    };
  // `browser_show` runs off the main thread, so two calls can overtake each other: the native side
  // ignores a call older than the last one it applied. The count starts at 1 with every load of the page,
  // the native state outlives it: `showEpoch` names this page life, so the first call after a reload counts.
  let showSeq = 0;
  const showEpoch = pageEpoch();
  return {
    supported: true,
    open(options: BrowserOpenOptions, onEvent: (event: BrowserEvent) => void) {
      const events = new Channel<BrowserEvent>();
      events.onmessage = onEvent;
      return invoke<void>('browser_open', { options, events });
    },
    navigate: (tab: number, url: string, allowHttp = false) =>
      invoke<void>('browser_navigate', { tab, url, allowHttp }),
    back: (tab: number) => invoke<void>('browser_back', { tab }),
    forward: (tab: number) => invoke<void>('browser_forward', { tab }),
    reload: (tab: number) => invoke<void>('browser_reload', { tab }),
    close: (tab: number) => invoke<void>('browser_close', { tab }),
    show: (tab: number | null, bounds?: BrowserBounds) =>
      invoke<number[]>('browser_show', { tab, bounds, epoch: showEpoch, seq: ++showSeq }),
    setZoom: (tab: number, factor: number) => invoke<void>('browser_set_zoom', { tab, factor }),
    configure: (config: BrowserConfig) => invoke<void>('browser_configure', { config }),
    clearData: () => invoke<void>('browser_clear_data'),
  };
}
