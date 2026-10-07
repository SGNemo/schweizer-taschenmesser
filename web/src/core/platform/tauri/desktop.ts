import { invoke } from '@tauri-apps/api/core';
import { onCaptureOpenEvent, onVaultSearchEvent, webDesktop } from '../web';
import type { DesktopService, HotkeyError } from '../types';

const isHotkeyError = (v: unknown): v is HotkeyError =>
  v === 'invalid' || v === 'taken' || v === 'failed';

/**
 * Talks to `src-tauri/src/capture.rs`. Every call is one app command; on Android and in the
 * browser the service is inert (`supported: false`).
 */
async function register(command: string, accelerator: string | null): Promise<HotkeyError | null> {
  try {
    await invoke(command, { accelerator });
    return null;
  } catch (e) {
    return isHotkeyError(e) ? e : 'failed';
  }
}

export function createDesktopService(supported: boolean): DesktopService {
  if (!supported) return webDesktop;
  return {
    supported,
    safeMode: () => invoke<boolean>('desktop_safe_mode'),
    setHotkey: (accelerator) => register('capture_set_hotkey', accelerator),
    setVaultHotkey: (accelerator) => register('desktop_set_vault_hotkey', accelerator),
    setCloseToTray: (enabled) => invoke('desktop_set_close_to_tray', { enabled }),
    setTrayLabels: (labels) => invoke('desktop_set_tray_labels', { labels }),
    setAutostart: (enabled) => invoke('desktop_set_autostart', { enabled }),
    autostart: () => invoke<boolean>('desktop_autostart_enabled'),
    info: () => invoke<{ portable: boolean }>('desktop_info'),
    async dataDir() {
      return (await invoke<string | null>('desktop_data_dir')) ?? undefined;
    },
    openDataDir: () => invoke('desktop_open_data_dir'),
    showMain: () => invoke('desktop_show_main'),
    hideCapture: () => invoke('capture_hide'),
    async readClipboard() {
      return (await invoke<string | null>('capture_read_clipboard')) ?? undefined;
    },
    onCaptureOpen: onCaptureOpenEvent,
    onVaultSearch: onVaultSearchEvent,
  };
}
