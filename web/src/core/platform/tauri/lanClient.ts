import { Channel, invoke } from '@tauri-apps/api/core';
import type { LanClientService, LanPairing } from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/** The device side of home-network sync (phone, second PC; `src-tauri/src/lan_client.rs`); the QR is scanned in the app. */
export function createLanClient(supported: boolean): LanClientService {
  const unsupported = () => Promise.reject(new Error('unsupported'));
  if (!supported) {
    return {
      supported,
      pair: unsupported,
      cancelPair: async () => undefined,
      request: unsupported,
      unpair: unsupported,
    };
  }
  return {
    supported,
    pair(qr, name, onCode) {
      const channel = new Channel<string>();
      channel.onmessage = (code) => onCode(code);
      return call<LanPairing>('lan_client_pair', { qr, name, onCode: channel });
    },
    cancelPair: () => call<void>('lan_client_pair_cancel'),
    request: (body, hub) => call<string>('lan_client_request', { body, hub }),
    unpair: () => call<void>('lan_client_unpair'),
  };
}
