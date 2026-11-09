/**
 * E2E stand-in for the phone's side of home-network sync (`src-tauri/src/lan_client.rs`). Only in
 * `--mode e2e` builds and only when a spec sets `localStorage['tm-e2e-lanclient'] = '1'`. The hub
 * behind it is the append-only fake of `fakeLanHub.ts` (no last-write-wins). Tests drive it through
 * `window.__tmLanClient`: `nextScan(text)`, `confirm()` (the user tapped "Koppeln" on the PC),
 * `refuse()` (the hub authenticated an `unknown-device`). The Wi-Fi of `createFakeLanWatch` (same flag)
 * is switched with `window.__tmLanWatch.set(connected)`.
 */
import { createFakeLanHubParts } from './fakeLanHub';
import type { LanClientService, LanHubDataKey, LanWatchService } from './types';

const FAKE_HUB = 'ab'.repeat(32);

const E2E_FLAG = 'tm-e2e-lanclient';

export const noLanClient: LanClientService = {
  supported: false,
  pair: () => Promise.reject(new Error('unsupported')),
  cancelPair: async () => undefined,
  request: () => Promise.reject(new Error('unsupported')),
  unpair: () => Promise.reject(new Error('unsupported')),
};

export function createFakeLanClient(): LanClientService {
  const { hub } = createFakeLanHubParts();
  let scanText: string | undefined;
  let confirm: ((key: LanHubDataKey) => void) | undefined;
  let fail: ((e: Error) => void) | undefined;
  let paired = false;
  let refused = false;

  const client: LanClientService = {
    get supported() {
      try {
        return localStorage.getItem(E2E_FLAG) === '1';
      } catch {
        return false;
      }
    },
    scan: async () => {
      if (scanText === undefined) throw new Error('cancelled');
      const text = scanText;
      scanText = undefined;
      return text;
    },
    pair: async (qr, _name, onCode) => {
      if (!qr.startsWith('NEMO1:')) throw new Error('bad-qr');
      if (qr === 'NEMO1:used') throw new Error('pairing-not-possible');
      const { dataKey } = await hub.start();
      onCode('482913');
      const key = await new Promise<LanHubDataKey>((resolve, reject) => {
        confirm = resolve;
        fail = reject;
      }).finally(() => {
        confirm = undefined;
        fail = undefined;
      });
      paired = true;
      refused = false;
      return { ...(key ?? dataKey), hub: FAKE_HUB };
    },
    cancelPair: async () => fail?.(new Error('cancelled')),
    request: async (body, pinned) => {
      if (!paired) throw new Error('not-paired');
      if (pinned !== FAKE_HUB) throw new Error('network');
      if (refused) throw new Error('unknown-device');
      return hub.request(body);
    },
    unpair: async () => {
      paired = false;
    },
  };

  if (typeof window !== 'undefined')
    (window as unknown as { __tmLanClient?: unknown }).__tmLanClient = {
      nextScan: (text: string) => {
        scanText = text;
      },
      confirm: async () => confirm?.((await hub.start()).dataKey),
      refuse: () => {
        refused = true;
      },
    };
  return client;
}

/** Browser and desktop: nothing is watched (`wifi()` is unknown, nothing fires). */
export const noLanWatch: LanWatchService = {
  supported: false,
  wifi: async () => undefined,
  onWifiChange: () => () => undefined,
};

/** E2E stand-in for the `lan-watch` plugin: Wi-Fi starts connected; specs switch it. */
export function createFakeLanWatch(): LanWatchService {
  let connected = true;
  const listeners = new Set<(connected: boolean) => void>();
  const watch: LanWatchService = {
    get supported() {
      try {
        return localStorage.getItem(E2E_FLAG) === '1';
      } catch {
        return false;
      }
    },
    wifi: async () => (watch.supported ? connected : undefined),
    onWifiChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  if (typeof window !== 'undefined')
    (window as unknown as { __tmLanWatch?: unknown }).__tmLanWatch = {
      set: (next: boolean) => {
        if (next === connected) return;
        connected = next;
        for (const l of listeners) l(next);
      },
    };
  return watch;
}
