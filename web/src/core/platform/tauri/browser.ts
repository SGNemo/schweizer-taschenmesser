import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  BrowserConfig,
  BrowserBounds,
  BrowserEvent,
  BrowserOpenOptions,
  BrowserService,
} from '../browser';

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

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
  // ignores a call older than the last one it applied.
  let showSeq = 0;
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
      invoke<number[]>('browser_show', { tab, bounds, seq: ++showSeq }),
    setZoom: (tab: number, factor: number) => invoke<void>('browser_set_zoom', { tab, factor }),
    configure: (config: BrowserConfig) => invoke<void>('browser_configure', { config }),
    clearData: () => invoke<void>('browser_clear_data'),
  };
}
