import { Channel, invoke } from '@tauri-apps/api/core';
import type { VaultBridgeRegistration, VaultBridgeRequest, VaultBridgeService } from '../types';

const isStartError = (v: unknown): v is 'channel-taken' | 'failed' =>
  v === 'channel-taken' || v === 'failed';

/** The desktop shell's pipe server for the browser extension host; answers go back by request id. */
export function createVaultBridge(supported: boolean): VaultBridgeService {
  const unsupported = () => Promise.reject(new Error('unsupported'));
  if (!supported) {
    return {
      supported,
      start: unsupported,
      stop: async () => undefined,
      register: unsupported,
      unregister: unsupported,
      status: unsupported,
    };
  }
  return {
    supported,
    async start(onRequest) {
      const channel = new Channel<VaultBridgeRequest>();
      channel.onmessage = (req) => {
        void (async () => {
          let body: string;
          try {
            body = await onRequest(req);
          } catch {
            // Codes only: nothing about the request leaks into the answer.
            body = '{"v":1,"id":"","ok":false,"error":"internal"}';
          }
          await invoke('vault_bridge_respond', { id: req.id, body }).catch(() => undefined);
        })();
      };
      try {
        await invoke('vault_bridge_start', { onRequest: channel });
        return null;
      } catch (e) {
        return isStartError(e) ? e : 'failed';
      }
    },
    stop: () => invoke('vault_bridge_stop'),
    register: () => invoke<VaultBridgeRegistration>('vault_bridge_register'),
    unregister: () => invoke('vault_bridge_unregister'),
    status: () => invoke<VaultBridgeRegistration>('vault_bridge_status'),
  };
}
