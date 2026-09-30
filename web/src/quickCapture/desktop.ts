import { getPlatform, type HotkeyError } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { readPrefs } from './device';

/** Human-readable accelerator for messages: `Ctrl+Shift+Space` → `Strg+Umschalt+Leertaste`. */
export function hotkeyLabel(accelerator: string): string {
  const names: Record<string, string> = {
    ctrl: 'Strg',
    control: 'Strg',
    commandorcontrol: 'Strg',
    cmdorctrl: 'Strg',
    shift: 'Umschalt',
    alt: 'Alt',
    space: 'Leertaste',
    super: 'Win',
    meta: 'Win',
  };
  return accelerator
    .split('+')
    .map((p) => names[p.toLowerCase()] ?? p)
    .join('+');
}

/** Applies a hotkey; resolves to an error code or `null`. */
export const applyHotkey = (accelerator: string): Promise<HotkeyError | null> =>
  getPlatform().desktop.setHotkey(accelerator || null);

/**
 * Applies the stored per-device switches to the native shell at startup: tray labels, "close to
 * tray", the hotkey, and a refresh of the autostart entry (the executable may have moved). A
 * hotkey that cannot be registered is reported once as a toast; Settings shows the details.
 */
export async function startQuickCaptureDesktop(): Promise<void> {
  const desktop = getPlatform().desktop;
  if (!desktop.supported) return;
  const prefs = readPrefs();
  try {
    await desktop.setTrayLabels(t.quickCapture.tray);
    await desktop.setCloseToTray(prefs.closeToTray);
    if (prefs.autostart) await desktop.setAutostart(true);
  } catch {
    // The shell is older than this frontend or the call was refused; the app still works.
  }
  if (prefs.hotkey) {
    const error = await applyHotkey(prefs.hotkey);
    if (error) {
      useUiStore
        .getState()
        .toast(t.quickCapture.settings.hotkeyStartupError(hotkeyLabel(prefs.hotkey)));
    }
  }
}
