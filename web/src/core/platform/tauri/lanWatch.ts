import { addPluginListener, invoke, type PluginListener } from '@tauri-apps/api/core';
import { noLanWatch } from '../fakeLanClient';
import type { LanWatchService } from '../types';

/**
 * Android: the `lan-watch` plugin (`src-tauri/plugins/lan-watch`) – a `NetworkCallback` for Wi-Fi
 * that fires `wifi-available` / `wifi-lost`, and `wifi_state`. Its hub search is Rust-only.
 */
export function createLanWatch(supported: boolean): LanWatchService {
  if (!supported) return noLanWatch;
  return {
    supported,
    async wifi() {
      try {
        const state = await invoke<{ supported: boolean; connected: boolean }>(
          'plugin:lan-watch|wifi_state',
        );
        return state.supported ? state.connected : undefined;
      } catch {
        return undefined;
      }
    },
    onWifiChange(callback) {
      let stopped = false;
      const listeners: PluginListener[] = [];
      const listen = (event: string, connected: boolean) =>
        addPluginListener('lan-watch', event, () => callback(connected))
          .then((l) => {
            if (stopped) void l.unregister().catch(() => undefined);
            else listeners.push(l);
          })
          .catch(() => undefined);
      void listen('wifi-available', true);
      void listen('wifi-lost', false);
      return () => {
        stopped = true;
        for (const l of listeners.splice(0)) void l.unregister().catch(() => undefined);
      };
    },
  };
}
