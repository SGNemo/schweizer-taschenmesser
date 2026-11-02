/**
 * Full screen, immersive mode and keep-awake in the native shell (cockpit). Desktop: the Tauri
 * window. Android: the local `screen-mode` plugin (`src-tauri/plugins/screen-mode`, system bars
 * and `FLAG_KEEP_SCREEN_ON`); the window itself cannot go "full screen" there, so the webview's
 * Fullscreen API answers that request and the bars go through the plugin.
 */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { createWebDisplay } from '../web';
import type { DisplayService, PlatformKind } from '../types';

const call = (command: string, enabled: boolean) =>
  invoke<void>(`plugin:screen-mode|${command}`, { request: { enabled } });

export function createDisplay(kind: PlatformKind): DisplayService {
  if (kind === 'android') {
    const web = createWebDisplay();
    return {
      fullscreenSupported: false,
      setFullscreen: (on) => web.setFullscreen(on),
      isFullscreen: () => web.isFullscreen(),
      async setImmersive(on) {
        try {
          await call('set_immersive', on);
        } catch (e) {
          console.warn('[platform] could not change immersive mode', e);
        }
      },
      async setKeepAwake(on) {
        try {
          await call('set_keep_awake', on);
        } catch (e) {
          console.warn('[platform] could not change keep-awake', e);
        }
      },
    };
  }
  const win = () => getCurrentWindow();
  return {
    fullscreenSupported: true,
    async setFullscreen(on) {
      try {
        await win().setFullscreen(on);
      } catch (e) {
        console.warn('[platform] could not change full screen', e);
      }
    },
    isFullscreen: () => win().isFullscreen(),
    setImmersive: async () => undefined,
    // Desktop screens have no keep-awake request in the shell; the browser wake lock does nothing there either.
    setKeepAwake: async () => undefined,
  };
}
