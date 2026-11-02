import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getPlatform } from '@/core/platform';
import { isTypingTarget } from '@/core/keyboard/typing';
import { tCockpit } from '@/strings.cockpit';
import { useUiStore } from '@/stores/ui';

/** Where the cockpit draws its widgets: the home route. Any other path shows inside the panel. */
export const COCKPIT_HOME = '/';

let enteredToastShown = false;
/** True while the cockpit itself asked for full screen (so leaving the cockpit gives it back). */
let fullscreenByCockpit = false;

/** Switches the cockpit on: the overview takes the whole window; a short hint says how to leave. */
export function enterCockpit(navigate: (to: string) => void, pathname: string): void {
  const ui = useUiStore.getState();
  if (pathname !== COCKPIT_HOME) navigate(COCKPIT_HOME);
  ui.setCockpit(true);
  if (!enteredToastShown) {
    enteredToastShown = true;
    ui.toast(tCockpit.get().entered);
  }
}

/** Switches the cockpit off and gives back a full screen the cockpit requested. */
export function exitCockpit(): void {
  useUiStore.getState().setCockpit(false);
  useUiStore.getState().setHomeEditing(false);
  if (fullscreenByCockpit) {
    fullscreenByCockpit = false;
    void getPlatform().display.setFullscreen(false);
  }
}

/** F11 / the bar button: real full screen on top of the cockpit (desktop window, browser API). */
export async function toggleCockpitFullscreen(): Promise<void> {
  const display = getPlatform().display;
  if (!display.fullscreenSupported) return;
  const on = !(await display.isFullscreen());
  fullscreenByCockpit = on;
  await display.setFullscreen(on);
}

/** Only an element that is currently open: a closed native <dialog> has no `open` attribute. */
const dialogOpen = (): boolean => !!document.querySelector('dialog[open]');

/**
 * Keys, Android bars and the wake lock of the cockpit. Mounted once in the shell.
 *  - F10 is the rebindable `cockpit` action (`core/keyboard/map.ts`), so it is not handled here.
 *  - Esc: a module panel closes first, then the cockpit; never while a dialog is open or in a field.
 *  - F11: real full screen while the cockpit is on (otherwise the browser keeps its own F11).
 */
export function useCockpit(): void {
  const cockpit = useUiStore((s) => s.cockpit);
  const awake = useUiStore((s) => s.cockpitAwake);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!cockpit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'F11') {
        e.preventDefault();
        void toggleCockpitFullscreen();
      } else if (e.key === 'Escape') {
        if (dialogOpen() || isTypingTarget(e.target) || useUiStore.getState().homeEditing) return;
        e.preventDefault();
        if (pathname !== COCKPIT_HOME) void navigate(COCKPIT_HOME);
        else exitCockpit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cockpit, pathname, navigate]);

  // Android: system bars away while the cockpit is on; the screen stays on if the user asked for it.
  useEffect(() => {
    const display = getPlatform().display;
    void display.setImmersive(cockpit);
    void display.setKeepAwake(cockpit && awake);
    return () => {
      if (cockpit) {
        void display.setImmersive(false);
        void display.setKeepAwake(false);
      }
    };
  }, [cockpit, awake]);
}
