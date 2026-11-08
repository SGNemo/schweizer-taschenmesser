import { Channel, invoke } from '@tauri-apps/api/core';
import type { LanClientService, LanHubDataKey } from '../types';

/** Rust answers with a short code string on failure; keep it as the error message. */
const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> =>
  invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === 'string' ? e : 'failed');
  });

/** The phone's side of home-network sync (`src-tauri/src/lan_client.rs`) and the native QR scanner. */
export function createLanClient(supported: boolean): LanClientService {
  const unsupported = () => Promise.reject(new Error('unsupported'));
  if (!supported) {
    return {
      supported,
      scan: unsupported,
      pair: unsupported,
      cancelPair: async () => undefined,
      request: unsupported,
      unpair: unsupported,
    };
  }
  return {
    supported,
    async scan() {
      const scanner = await import('@tauri-apps/plugin-barcode-scanner');
      let permission = await scanner.checkPermissions();
      if (permission !== 'granted') permission = await scanner.requestPermissions();
      if (permission !== 'granted') throw new Error('camera-denied');
      try {
        const result = await scanner.scan({ formats: [scanner.Format.QRCode] });
        return result.content;
      } catch {
        throw new Error('cancelled');
      }
    },
    pair(qr, name, onCode) {
      const channel = new Channel<string>();
      channel.onmessage = (code) => onCode(code);
      return call<LanHubDataKey>('lan_client_pair', { qr, name, onCode: channel });
    },
    cancelPair: () => call<void>('lan_client_pair_cancel'),
    request: (body) => call<string>('lan_client_request', { body }),
    unpair: () => call<void>('lan_client_unpair'),
  };
}
