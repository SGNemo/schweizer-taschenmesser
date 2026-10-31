import { getLang, onLangChange } from '@/core/i18n/lang';
import { getPlatform, type DesktopService, type HotkeyError } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { useTimer } from '@/tools/timer/engine';
import { isRunning } from '@/tools/timer/logic';
import { readPrefs } from './device';

/** Minutes of the tray's "Timer 25 Minuten". */
export const TRAY_TIMER_MIN = 25;

/** Opens an in-app route from outside React (the router follows `popstate`). */
function openRoute(route: string): void {
  history.pushState(null, '', route);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** "Timer 25 Minuten": starts it unless a timer already runs, and shows the timer tool. */
export function startTrayTimer(): void {
  const timer = useTimer.getState();
  if (!isRunning(timer.timer)) {
    timer.setMode('timer');
    timer.setMinutes(TRAY_TIMER_MIN);
    timer.start();
  }
  useUiStore.getState().openTools('timer');
}

/**
 * The tray's "Heute" block: keeps its snapshot current and acts on its clicks (the shell has
 * already brought the main window forward). Off with the switch in Settings → Schnellerfassung.
 */
export async function startTrayToday(desktop: DesktopService): Promise<() => void> {
  const tray = await import('@/core/platform/tauri/traySnapshot');
  const stopSnapshot = tray.startTraySnapshot(desktop, () => readPrefs().trayToday);
  // The labels are native: send them again in the new language.
  const stopLang = onLangChange(tray.refreshTraySnapshot);
  const stopClicks = tray.onTrayItem((id) => {
    const action = tray.trayAction(id);
    if (action?.kind === 'timer') startTrayTimer();
    else if (action) openRoute(action.route);
  });
  return () => {
    stopSnapshot();
    stopLang();
    stopClicks();
  };
}

/** After the switch changed: show or hide the block at once (no-op outside the desktop app). */
export function refreshTrayToday(): void {
  if (!getPlatform().desktop.supported) return;
  void import('@/core/platform/tauri/traySnapshot').then((tray) => tray.refreshTraySnapshot());
}

/** Human-readable accelerator for messages: `Ctrl+Shift+Space` → `Strg+Umschalt+Leertaste` (German UI only). */
export function hotkeyLabel(accelerator: string): string {
  const de = getLang() === 'de';
  const names: Record<string, string> = {
    ctrl: de ? 'Strg' : 'Ctrl',
    control: de ? 'Strg' : 'Ctrl',
    commandorcontrol: de ? 'Strg' : 'Ctrl',
    cmdorctrl: de ? 'Strg' : 'Ctrl',
    shift: de ? 'Umschalt' : 'Shift',
    alt: 'Alt',
    space: de ? 'Leertaste' : 'Space',
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

export const applyVaultHotkey = (accelerator: string): Promise<HotkeyError | null> =>
  getPlatform().desktop.setVaultHotkey(accelerator || null);

/**
 * Applies the stored per-device switches to the native shell at startup: tray labels, "close to
 * tray", the hotkey, and a refresh of the autostart entry (the executable may have moved). A
 * hotkey that cannot be registered is reported once as a toast; Settings shows the details.
 */
export async function startQuickCaptureDesktop(): Promise<void> {
  const desktop = getPlatform().desktop;
  if (!desktop.supported) return;
  const prefs = readPrefs();
  // The tray menu is native: send its labels again whenever the UI language changes.
  onLangChange(() => void desktop.setTrayLabels({ ...t.quickCapture.tray }).catch(() => {}));
  try {
    await desktop.setTrayLabels({ ...t.quickCapture.tray });
    await desktop.setCloseToTray(prefs.closeToTray);
    if (prefs.autostart) await desktop.setAutostart(true);
  } catch {
    // The shell is older than this frontend or the call was refused; the app still works.
  }
  void startTrayToday(desktop).catch(() => undefined);
  if (prefs.hotkey) {
    const error = await applyHotkey(prefs.hotkey);
    if (error) {
      useUiStore
        .getState()
        .toast(t.quickCapture.settings.hotkeyStartupError(hotkeyLabel(prefs.hotkey)));
    }
  }
  if (prefs.vaultHotkey) {
    const error = await applyVaultHotkey(prefs.vaultHotkey);
    if (error) {
      useUiStore
        .getState()
        .toast(t.quickCapture.settings.hotkeyStartupError(hotkeyLabel(prefs.vaultHotkey)));
    }
  }
}
