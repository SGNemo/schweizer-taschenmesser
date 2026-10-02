/**
 * E2E stand-in for the desktop shell's pipe server (`src-tauri/crates/vault-bridge`), which a
 * browser test cannot start. It hands a raw request (JSON text, as the native host would relay it)
 * to the same app handler; framing, origin stamping and the pipe itself are covered by the Rust
 * tests. Only wired up when the app is built with `--mode e2e` (see `web.ts`); tests call
 * `window.__tmVaultBridge.request(json)`.
 */
import type { VaultBridgeRegistration, VaultBridgeRequest, VaultBridgeService } from './types';

export function createFakeVaultBridge(): VaultBridgeService {
  let handler: ((req: VaultBridgeRequest) => Promise<string>) | null = null;
  let nextId = 1;
  let registered = false;
  const registration = (): VaultBridgeRegistration => ({
    browsers: ['Brave', 'Chrome', 'Edge', 'Chromium'].map((browser) => ({ browser, registered })),
    upToDate: registered,
    manifest: 'C:\\Beispiel\\Nemo\\data\\native-messaging\\vault.json',
  });

  const request = async (json: string): Promise<string | null> =>
    handler ? handler({ id: nextId++, body: json }) : null; // null = nothing listens

  return {
    supported: true,
    async start(onRequest) {
      handler = onRequest;
      (window as unknown as { __tmVaultBridge?: unknown }).__tmVaultBridge = { request };
      return null;
    },
    async stop() {
      handler = null;
      delete (window as unknown as { __tmVaultBridge?: unknown }).__tmVaultBridge;
    },
    async register() {
      registered = true;
      return registration();
    },
    async unregister() {
      registered = false;
    },
    async status() {
      return registration();
    },
  };
}
