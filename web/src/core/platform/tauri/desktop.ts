import { invoke } from '@tauri-apps/api/core';
import { onCaptureOpenEvent, webDesktop } from '../web';
import type { DesktopService, HotkeyError } from '../types';

const isHotkeyError = (v: unknown): v is HotkeyError =>
  v === 'invalid' || v === 'taken' || v === 'failed';

/**
 * Talks to `src-tauri/src/capture.rs`. Every call is one app command; on Android and in the
 * browser the service is inert (`supported: false`).
 */
export function createDesktopService(supported: boolean): DesktopService {
  if (!supported) return webDesktop;
  return {
    supported,
    async setHotkey(accelerator) {
      try {
        await invoke('capture_set_hotkey', { accelerator });
        return null;
      } catch (e) {
        return isHotkeyError(e) ? e : 'failed';
      }
    },
    setCloseToTray: (enabled) => invoke('desktop_set_close_to_tray', { enabled }),
    setTrayLabels: (labels) => invoke('desktop_set_tray_labels', { labels }),
    setAutostart: (enabled) => invoke('desktop_set_autostart', { enabled }),
    autostart: () => invoke<boolean>('desktop_autostart_enabled'),
    info: () => invoke<{ portable: boolean }>('desktop_info'),
    showMain: () => invoke('desktop_show_main'),
    hideCapture: () => invoke('capture_hide'),
    async readClipboard() {
      return (await invoke<string | null>('capture_read_clipboard')) ?? undefined;
    },
    onCaptureOpen: onCaptureOpenEvent,
  };
}
